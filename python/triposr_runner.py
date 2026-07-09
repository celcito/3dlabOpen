import logging
import os
from typing import Optional

import _mcubes_shim  # injects CPU fallback if torchmcubes not installed
import numpy as np
import torch
from PIL import Image

logger = logging.getLogger(__name__)


def infer(
    image_path: str,
    output_dir: str,
    foreground_ratio: float = 0.85,
    mc_resolution: int = 256,
    remove_bg: bool = True,
    progress_callback: Optional[callable] = None,
) -> dict:
    try:
        from tsr.system import TSR
    except ImportError as e:
        raise RuntimeError(
            f"TripoSR not installed — {e}. "
            "Run ./python/run.sh to install deps, "
            "or cd python && pip install -r requirements.txt onnxruntime"
        )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        logger.warning("CUDA not available — inference will be slow on CPU")

    if progress_callback:
        progress_callback(5, "loading_model")

    model = TSR.from_pretrained(
        "stabilityai/TripoSR",
        config_name="config.yaml",
        weight_name="model.ckpt",
    )
    model.to(device)

    if progress_callback:
        progress_callback(15, "model_loaded")

    image = Image.open(image_path).convert("RGB")

    if remove_bg:
        try:
            image = _rembg_remove_bg(image, foreground_ratio)
        except ImportError:
            logger.warning(
                "rembg not installed, falling back to simple luminance-based "
                "background removal"
            )
            image = _luminance_remove_bg(image)
    else:
        image = Image.open(image_path).convert("RGB")

    if progress_callback:
        progress_callback(30, "preprocessing_done")

    with torch.no_grad():
        scene_codes = model([image], device=device)

    if progress_callback:
        progress_callback(60, "inference_done")

    os.makedirs(output_dir, exist_ok=True)

    meshes = model.extract_mesh(scene_codes, True, resolution=mc_resolution)
    glb_path = os.path.join(output_dir, "model.glb")
    meshes[0].export(glb_path)

    if progress_callback:
        progress_callback(100, "done")

    return {
        "glb_path": glb_path,
        "device": device,
        "foreground_ratio": foreground_ratio,
        "mc_resolution": mc_resolution,
    }


def _rembg_remove_bg(image: Image.Image, foreground_ratio: float) -> Image.Image:
    import rembg
    from tsr.utils import remove_background, resize_foreground

    session = rembg.new_session()
    image = remove_background(image, session)
    image = resize_foreground(image, foreground_ratio)
    image = np.array(image).astype(np.float32) / 255.0
    image = image[:, :, :3] * image[:, :, 3:4] + (1 - image[:, :, 3:4]) * 0.5
    return Image.fromarray((image * 255.0).astype(np.uint8))


def _luminance_remove_bg(pil_image: Image.Image) -> Image.Image:
    from torchvision.transforms import functional as F  # type: ignore

    img_tensor = F.to_tensor(pil_image)
    r, g, b = img_tensor[0], img_tensor[1], img_tensor[2]
    luminance = 0.299 * r + 0.587 * g + 0.114 * b
    mask = luminance > 0.05
    img_tensor = img_tensor * mask.float()
    return F.to_pil_image(img_tensor)
