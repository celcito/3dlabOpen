import base64
import os
import time
from pathlib import Path
from typing import Optional

import httpx

from convert import convert_glb_to_all

MESHY_API_BASE = "https://api.meshy.ai/openapi/v1/image-to-3d"


class MeshyError(RuntimeError):
    pass


def _api_key() -> str:
    key = os.environ.get("MESHY_API_KEY", "")
    if not key:
        raise MeshyError("MESHY_API_KEY não configurada. Consulte https://www.meshy.ai/api")
    return key


def create_task(image_path: str, model_version: Optional[str] = None) -> str:
    path = Path(image_path)
    if not path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")
    ext = path.suffix.lower().lstrip(".")
    mime = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg"}.get(ext)
    if not mime:
        raise MeshyError(f"Meshy suporta PNG/JPEG; recebido .{ext}")
    image_uri = f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"
    payload = {
        "image_url": image_uri,
        "ai_model": model_version or "latest",
        "should_texture": False,
        "should_remesh": True,
        "target_formats": ["glb"],
    }
    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            MESHY_API_BASE,
            headers={"Authorization": f"Bearer {_api_key()}", "Content-Type": "application/json"},
            json=payload,
        )
    if response.status_code not in (200, 201):
        raise MeshyError(f"Meshy API create failed ({response.status_code}): {response.text[:500]}")
    task_id = response.json().get("result")
    if not task_id:
        raise MeshyError("Meshy não retornou o id da tarefa.")
    return task_id


def wait_and_download(task_id: str, output_dir: str, progress_callback: Optional[callable] = None) -> dict:
    headers = {"Authorization": f"Bearer {_api_key()}"}
    while True:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(f"{MESHY_API_BASE}/{task_id}", headers=headers)
        if response.status_code != 200:
            raise MeshyError(f"Meshy API poll failed ({response.status_code}): {response.text[:500]}")
        data = response.json()
        status = data.get("status", "")
        progress = int(data.get("progress", 0) or 0)
        if progress_callback:
            progress_callback(min(80, 5 + int(progress * 0.7)), f"meshy_{status.lower() or 'processing'}")
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "CANCELED"):
            message = (data.get("task_error") or {}).get("message") or status
            raise MeshyError(f"Meshy task {task_id} falhou: {message}")
        time.sleep(2.0)

    model_url = (data.get("model_urls") or {}).get("glb")
    if not model_url:
        raise MeshyError("Meshy não retornou uma URL GLB.")
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    glb_path = output / "model.glb"
    with httpx.stream("GET", model_url, timeout=120.0, follow_redirects=True) as response:
        if response.status_code != 200:
            raise MeshyError(f"Meshy download failed ({response.status_code})")
        with glb_path.open("wb") as file:
            for chunk in response.iter_bytes(65536):
                file.write(chunk)
    if progress_callback:
        progress_callback(90, "meshy_converting")
    converted = convert_glb_to_all(str(glb_path), str(output))
    files = {}
    for fmt, source in converted.items():
        if source and Path(source).exists():
            destination = output / f"model.{fmt}"
            if Path(source) != destination:
                Path(source).replace(destination)
            files[fmt] = str(destination)
    return files
