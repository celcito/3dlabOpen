import os
import sys
import logging
import threading
import time
import shutil
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("triposr_api")

sys.path.insert(0, str(Path(__file__).parent))

# Auto-detect TripoSR path (clone location)
_triposr_home = Path.home() / "TripoSR"
if _triposr_home.is_dir() and str(_triposr_home) not in sys.path:
    sys.path.insert(0, str(_triposr_home))

from jobs import create_job, get_job, update_job, remove_old_jobs
from tripo_api import create_task, wait_and_download, TripoError

JOBS_DIR = Path(__file__).parent.parent / "tmp" / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    def cleanup_loop():
        while True:
            time.sleep(3600)
            remove_old_jobs(max_age_hours=24)
    t = threading.Thread(target=cleanup_loop, daemon=True)
    t.start()
    logger.info(f"TripoSR API started. Jobs dir: {JOBS_DIR}")
    yield


app = FastAPI(title="TripoSR Image-to-3D API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _run_inference(job_id: str, image_path: str, output_dir: str, mc_resolution: int = 256):
    from triposr_runner import infer
    from convert import convert_glb_to_all

    try:
        def progress(percent: int, step: str):
            update_job(job_id, "processing", progress=percent, step=step)

        update_job(job_id, "processing", progress=0, step="starting")

        result = infer(
            image_path=image_path,
            output_dir=output_dir,
            foreground_ratio=0.85,
            mc_resolution=mc_resolution,
            progress_callback=progress,
        )

        update_job(job_id, "processing", progress=75, step="converting_formats")

        convert_result = convert_glb_to_all(result["glb_path"], output_dir)

        job_dir = Path(output_dir)
        files = {}
        for fmt in ["glb", "obj", "stl"]:
            src = convert_result.get(fmt)
            if src and Path(src).exists():
                dest = job_dir / f"model.{fmt}"
                if Path(src) != dest:
                    shutil.move(src, dest)
                files[fmt] = str(dest)

        update_job(job_id, "done", progress=100, step="complete", files=files)
        logger.info(f"Job {job_id} completed: {files}")

    except Exception as e:
        logger.exception(f"Job {job_id} failed: {e}")
        update_job(job_id, "error", progress=0, step="error", error=str(e))


def _run_cloud_inference(job_id: str, image_path: str, output_dir: str, mc_resolution: int = 256):
    try:
        def progress(percent: int, step: str):
            update_job(job_id, "processing", progress=percent, step=step)

        update_job(job_id, "processing", progress=0, step="cloud_uploading")

        task_id = create_task(image_path, mc_resolution)

        update_job(job_id, "processing", progress=5, step="cloud_processing")
        logger.info(f"Cloud job {job_id} → Tripo task {task_id}")

        files = wait_and_download(
            task_id,
            output_dir,
            progress_callback=progress,
        )

        update_job(job_id, "done", progress=100, step="complete", files=files)
        logger.info(f"Cloud job {job_id} completed: {files}")

    except TripoError as e:
        logger.exception(f"Cloud job {job_id} failed: {e}")
        update_job(job_id, "error", progress=0, step="error", error=str(e))
    except Exception as e:
        logger.exception(f"Cloud job {job_id} failed: {e}")
        update_job(job_id, "error", progress=0, step="error", error=str(e))


@app.post("/generate")
async def generate(image: UploadFile = File(...), mc_resolution: int = 256, provider: str = "local"):
    if mc_resolution not in (128, 256, 384, 512):
        raise HTTPException(400, "mc_resolution must be 128, 256, 384, or 512")
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if not image.content_type or image.content_type not in allowed_types:
        raise HTTPException(400, f"File must be a raster image ({', '.join(allowed_types)}), got {image.content_type}")

    if provider not in ("local", "cloud"):
        raise HTTPException(400, "provider must be 'local' or 'cloud'")

    if provider == "cloud" and not os.environ.get("TRIPO_API_KEY"):
        raise HTTPException(500, "TRIPO_API_KEY environment variable is not set")

    job_id = create_job()
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    ext_map = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
    ext = ext_map.get(image.content_type, ".png")
    image_path = job_dir / f"input{ext}"
    contents = await image.read()

    try:
        from PIL import Image
        import io
        Image.open(io.BytesIO(contents)).verify()
    except Exception:
        raise HTTPException(400, "Uploaded file is not a valid image")

    image_path.write_bytes(contents)

    output_dir = job_dir

    if provider == "cloud":
        threading.Thread(
            target=_run_cloud_inference,
            args=(job_id, str(image_path), str(output_dir), mc_resolution),
            daemon=True,
        ).start()
    else:
        threading.Thread(
            target=_run_inference,
            args=(job_id, str(image_path), str(output_dir), mc_resolution),
            daemon=True,
        ).start()

    return {"jobId": job_id}


@app.get("/providers")
async def list_providers():
    providers = []
    try:
        import torch
        _ = torch
        providers.append({"id": "local", "label": "TripoSR (local)", "available": True})
    except ImportError:
        providers.append({"id": "local", "label": "TripoSR (local)", "available": False})

    has_cloud = bool(os.environ.get("TRIPO_API_KEY"))
    providers.append({
        "id": "cloud",
        "label": "Tripo v2.0 (cloud)",
        "available": has_cloud,
        "model_version": os.environ.get("TRIPO_MODEL_VERSION", "v2.0-20240919"),
    })
    return {"providers": providers}


@app.get("/jobs/{job_id}/stream")
async def job_stream(job_id: str):
    import queue

    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    q: queue.Queue = queue.Queue()
    job.listeners.append(q)

    job.emit("progress", {
        "status": job.status,
        "progress": job.progress,
        "step": job.step,
        "error": job.error,
        "files": job.files,
    })

    async def event_stream():
        try:
            while True:
                try:
                    data = await asyncio.to_thread(q.get, timeout=15)
                    yield data
                except queue.Empty:
                    yield "event: ping\ndata: {}\n\n"
                except Exception as exc:
                    logger.warning(f"SSE stream for job {job_id} closing: {exc}")
                    break
        except asyncio.CancelledError:
            logger.info(f"SSE stream for job {job_id} cancelled (client disconnected)")
        except Exception as exc:
            logger.exception(f"SSE stream for job {job_id} unexpected error: {exc}")
        finally:
            try:
                job.listeners.remove(q)
            except (ValueError, AttributeError):
                pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/jobs/{job_id}/status")
async def job_status(job_id: str):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return {
        "status": job.status,
        "progress": job.progress,
        "step": job.step,
        "error": job.error,
        "files": job.files,
    }


@app.get("/jobs/{job_id}/file/{fmt}")
async def job_file(job_id: str, fmt: str):
    if fmt not in ("glb", "obj", "stl"):
        raise HTTPException(400, "Format must be glb, obj, or stl")

    path = JOBS_DIR / job_id / f"model.{fmt}"
    if not path.exists():
        raise HTTPException(404, f"File not found: model.{fmt}")

    from fastapi.responses import FileResponse
    return FileResponse(str(path))


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/decimate")
async def decimate_endpoint(file: UploadFile = File(...), ratio: float = 0.5):
    if ratio <= 0 or ratio > 1:
        raise HTTPException(400, "Ratio must be between 0.01 and 1.0")
    decimate_dir = JOBS_DIR / "decimate"
    decimate_dir.mkdir(parents=True, exist_ok=True)

    import uuid
    from fastapi.responses import FileResponse
    from decimate import decimate_mesh_file

    job_dir = decimate_dir / uuid.uuid4().hex[:8]
    job_dir.mkdir(parents=True, exist_ok=True)

    input_path = job_dir / f"input_{file.filename or 'mesh.stl'}"
    contents = await file.read()
    input_path.write_bytes(contents)

    try:
        result = decimate_mesh_file(str(input_path), str(job_dir), ratio)
        return FileResponse(
            result["path"],
            filename="decimated.stl",
            media_type="application/sla",
            headers={
                "X-Original-Faces": str(result["original"]),
                "X-Target-Faces": str(result["target"]),
            },
        )
    except Exception as e:
        logger.exception(f"Decimate failed: {e}")
        raise HTTPException(500, f"Decimation failed: {e}")
    finally:
        import shutil
        shutil.rmtree(job_dir, ignore_errors=True)


def _run_text_to_3d(job_id: str, prompt: str, output_dir: str, mc_resolution: int = 256, clean_prompt: bool = True):
    try:
        from text_to_image import generate_image
    except ImportError:
        update_job(job_id, "error", progress=0, step="error",
                     error="diffusers not installed. Run: pip install diffusers accelerate safetensors")
        return

    from triposr_runner import infer
    from convert import convert_glb_to_all

    try:
        def progress(pct: int, step: str):
            update_job(job_id, "processing", progress=pct, step=step)

        update_job(job_id, "processing", progress=0, step="loading_text_model")

        image_path = str(Path(output_dir) / "input.png")
        generate_image(
            prompt=prompt,
            output_path=image_path,
            clean_prompt=clean_prompt,
            progress_callback=progress,
        )

        update_job(job_id, "processing", progress=40, step="text_model_unloaded")

        def triposr_progress(percent: int, step: str):
            mapped = 40 + int(percent * 0.55)
            update_job(job_id, "processing", progress=mapped, step=step)

        result = infer(
            image_path=image_path,
            output_dir=output_dir,
            foreground_ratio=0.85,
            mc_resolution=mc_resolution,
            progress_callback=triposr_progress,
        )

        update_job(job_id, "processing", progress=95, step="converting_formats")

        convert_result = convert_glb_to_all(result["glb_path"], output_dir)

        job_dir = Path(output_dir)
        files = {}
        for fmt in ["glb", "obj", "stl"]:
            src = convert_result.get(fmt)
            if src and Path(src).exists():
                dest = job_dir / f"model.{fmt}"
                if Path(src) != dest:
                    shutil.move(src, dest)
                files[fmt] = str(dest)

        update_job(job_id, "done", progress=100, step="complete", files=files)
        logger.info(f"Text-to-3D job {job_id} completed: {files}")

    except Exception as e:
        logger.exception(f"Text-to-3D job {job_id} failed: {e}")
        update_job(job_id, "error", progress=0, step="error", error=str(e))


class TextTo3DRequest:
    def __init__(self, prompt: str, mc_resolution: int = 256, clean_prompt: bool = True):
        self.prompt = prompt
        self.mc_resolution = mc_resolution
        self.clean_prompt = clean_prompt


@app.post("/text-to-3d")
async def text_to_3d_endpoint(request: dict):
    prompt = request.get("prompt", "")
    mc_resolution = request.get("mc_resolution", 256)
    clean_prompt = request.get("clean_prompt", True)
    provider = request.get("provider", "local")

    if not prompt or not prompt.strip():
        raise HTTPException(400, "prompt must not be empty")

    if mc_resolution not in (128, 256, 384, 512):
        raise HTTPException(400, "mc_resolution must be 128, 256, 384, or 512")

    if provider == "cloud":
        raise HTTPException(400, "Text-to-3D is only supported with local provider. Use image upload for cloud.")

    job_id = create_job()
    job_dir = JOBS_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    threading.Thread(
        target=_run_text_to_3d,
        args=(job_id, prompt, str(job_dir), mc_resolution, clean_prompt),
        daemon=True,
    ).start()

    return {"jobId": job_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001, log_level="info")
