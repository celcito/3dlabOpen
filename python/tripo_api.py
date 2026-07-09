import os
import base64
import logging
import time
from pathlib import Path
from typing import Optional

import httpx
from convert import convert_glb_to_all

logger = logging.getLogger(__name__)

TRIPO_API_BASE = "https://api.tripo3d.ai/v2/openapi"
TRIPO_DEFAULT_MODEL = "v2.0-20240919"

# v2.5 is available to some accounts; override via env
_model_version = os.environ.get("TRIPO_MODEL_VERSION", TRIPO_DEFAULT_MODEL)


class TripoError(RuntimeError):
    pass


def _api_key() -> str:
    key = os.environ.get("TRIPO_API_KEY", "")
    if not key:
        raise TripoError(
            "TRIPO_API_KEY not set. "
            "Get yours at https://studio.tripo3d.ai/settings/api"
        )
    return key


def _progress_texture_quality(mc_resolution: int) -> str:
    return "detailed" if mc_resolution >= 512 else "standard"


def create_task(
    image_path: str,
    mc_resolution: int = 256,
    model_version: Optional[str] = None,
) -> str:
    """
    Upload image and create a Tripo image-to-model task.
    Returns task_id.
    """
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    ext = path.suffix.lower().lstrip(".")
    if ext not in ("png", "jpg", "jpeg", "webp"):
        raise ValueError(f"Unsupported format: {ext}")

    with open(path, "rb") as fh:
        b64 = base64.b64encode(fh.read()).decode("utf-8")

    payload = {
        "type": "image_to_model",
        "file": {"type": ext, "data": b64},
        "model_version": model_version or _model_version,
        "texture_quality": _progress_texture_quality(mc_resolution),
        "texture_alignment": "original_image",
        "force_symmetry": False,
    }

    key = _api_key()
    url = f"{TRIPO_API_BASE}/task"
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}

    with httpx.Client(timeout=30.0) as client:
        resp = client.post(url, headers=headers, json=payload)
    if resp.status_code != 200:
        raise TripoError(f"Tripo API create failed ({resp.status_code}): {resp.text}")
    return resp.json()["data"]["task_id"]


def poll_task(task_id: str) -> dict:
    """
    Check task status.
    Returns dict: {status, progress, output: {model: url, ...}}
    """
    key = _api_key()
    url = f"{TRIPO_API_BASE}/task/{task_id}"
    headers = {"Authorization": f"Bearer {key}"}

    with httpx.Client(timeout=15.0) as client:
        resp = client.get(url, headers=headers)
    if resp.status_code != 200:
        raise TripoError(f"Tripo API poll failed ({resp.status_code}): {resp.text}")
    return resp.json()["data"]


def wait_and_download(
    task_id: str,
    output_dir: str,
    poll_interval: float = 1.5,
    progress_callback: Optional[callable] = None,
) -> dict:
    """
    Poll Tripo task until done, download model to output_dir,
    convert to GLB/OBJ/STL. Returns files dict.
    """
    while True:
        data = poll_task(task_id)
        status = data.get("status")
        pct = data.get("progress", 0)

        if status == "success":
            if progress_callback:
                progress_callback(80, "cloud_downloading")
            break
        elif status in ("failed", "cancelled", "unknown"):
            raise TripoError(f"Tripo task {task_id} ended with status: {status}")
        else:
            if progress_callback:
                # map 0-100 api progress to 5-75 our range
                mapped = 5 + int(pct * 0.70)
                progress_callback(mapped, f"cloud_{status or 'processing'}")

        time.sleep(poll_interval)

    output = data.get("output", {})
    model_url = output.get("model") or output.get("pbr_model")
    if not model_url:
        raise TripoError(f"No model URL in Tripo task output: {list(output.keys())}")

    os.makedirs(output_dir, exist_ok=True)
    glb_path = os.path.join(output_dir, "model.glb")

    _download_file(model_url, glb_path)
    logger.info(f"Downloaded Tripo model to {glb_path}")

    if progress_callback:
        progress_callback(90, "cloud_converting")

    convert_result = convert_glb_to_all(glb_path, output_dir)
    import shutil

    files = {}
    for fmt in ("glb", "obj", "stl"):
        src = convert_result.get(fmt)
        if src and Path(src).exists():
            dest = os.path.join(output_dir, f"model.{fmt}")
            if Path(src) != Path(dest):
                shutil.move(src, dest)
            files[fmt] = str(dest)

    return files


def _download_file(url: str, dest: str) -> None:
    key = _api_key()
    headers = {"Authorization": f"Bearer {key}"}

    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        with client.stream("GET", url, headers=headers) as resp:
            if resp.status_code != 200:
                raise TripoError(
                    f"Download failed ({resp.status_code}): {resp.text[:200]}"
                )
            with open(dest, "wb") as fh:
                for chunk in resp.iter_bytes(65536):
                    fh.write(chunk)
