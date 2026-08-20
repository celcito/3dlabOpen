import os
import sys
import logging
import threading
import time
import shutil
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("triposr_api")

sys.path.insert(0, str(Path(__file__).parent))

# Auto-detect TripoSR path (clone location)
_triposr_home = Path.home() / "TripoSR"
if _triposr_home.is_dir() and str(_triposr_home) not in sys.path:
    sys.path.insert(0, str(_triposr_home))

import numpy as np
import trimesh
from jobs import create_job, get_job, update_job, remove_old_jobs
from tripo_api import create_task, wait_and_download, TripoError

JOBS_DIR = Path(__file__).parent.parent / "tmp" / "jobs"
JOBS_DIR.mkdir(parents=True, exist_ok=True)

HUNYUAN_VERSIONS = [
    {"id": "hunyuan3d-2", "label": "Hunyuan3D-2"},
    {"id": "hunyuan3d-2.1", "label": "Hunyuan3D-2.1"},
    {"id": "hunyuan3d-mini", "label": "Hunyuan3D Mini"},
]


def provider_catalog():
    local_available = False
    try:
        import torch
        _ = torch
        local_available = True
    except ImportError:
        pass

    return [
        {
            "id": "local",
            "label": "TripoSR local",
            "modes": ["image", "text"],
            "available": local_available,
            "reason": None if local_available else "Instale o runtime local do TripoSR.",
            "hint": "Sem custo de API; usa o modelo instalado nesta máquina.",
        },
        {
            "id": "tripo",
            "label": "Tripo AI",
            "modes": ["image"],
            "available": bool(os.environ.get("TRIPO_API_KEY")),
            "reason": None if os.environ.get("TRIPO_API_KEY") else "Configure TRIPO_API_KEY no ambiente.",
            "hint": "Geração em nuvem com o adaptador Tripo existente.",
            "pricing": "Consulte os créditos da sua conta Tripo AI.",
            "model_version": os.environ.get("TRIPO_MODEL_VERSION", "v2.0-20240919"),
        },
        {
            "id": "meshy",
            "label": "Meshy AI",
            "modes": ["image"],
            "available": bool(os.environ.get("MESHY_API_KEY")),
            "reason": None if os.environ.get("MESHY_API_KEY") else "Configure MESHY_API_KEY no ambiente.",
            "hint": "Geração de imagem para 3D via Meshy AI.",
            "pricing": "Cobrado por tarefa; os créditos consumidos variam conforme o modelo.",
        },
        {
            "id": "hunyuan3d",
            "label": "Hunyuan3D",
            "modes": ["image"],
            "available": False,
            "reason": "Adaptador Hunyuan3D ainda não configurado.",
            "hint": "Escolha uma versão quando o backend Hunyuan estiver instalado.",
            "versions": [
                {**version, "available": False, "reason": "Backend Hunyuan3D não configurado."}
                for version in HUNYUAN_VERSIONS
            ],
        },
    ]


def normalize_provider(provider: str) -> str:
    return "tripo" if provider == "cloud" else provider


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


def _run_cloud_inference(job_id: str, image_path: str, output_dir: str, mc_resolution: int = 256, model_version: str | None = None):
    try:
        def progress(percent: int, step: str):
            update_job(job_id, "processing", progress=percent, step=step)

        update_job(job_id, "processing", progress=0, step="cloud_uploading")

        task_id = create_task(image_path, mc_resolution, model_version=model_version)

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


def _run_meshy_inference(job_id: str, image_path: str, output_dir: str, model_version: str | None = None):
    try:
        from meshy_api import create_task, wait_and_download

        def progress(percent: int, step: str):
            update_job(job_id, "processing", progress=percent, step=step)

        update_job(job_id, "processing", progress=0, step="meshy_uploading")
        task_id = create_task(image_path, model_version=model_version)
        files = wait_and_download(task_id, output_dir, progress_callback=progress)
        update_job(job_id, "done", progress=100, step="complete", files=files)
        logger.info(f"Meshy job {job_id} completed: {files}")
    except Exception as e:
        logger.exception(f"Meshy job {job_id} failed: {e}")
        update_job(job_id, "error", progress=0, step="error", error=str(e))
    except Exception as e:
        logger.exception(f"Cloud job {job_id} failed: {e}")
        update_job(job_id, "error", progress=0, step="error", error=str(e))


@app.post("/generate")
async def generate(image: UploadFile = File(...), mc_resolution: int = 256, provider: str = "local", model_version: str | None = None):
    if mc_resolution not in (128, 256, 384, 512):
        raise HTTPException(400, "mc_resolution must be 128, 256, 384, or 512")
    allowed_types = {"image/png", "image/jpeg", "image/webp"}
    if not image.content_type or image.content_type not in allowed_types:
        raise HTTPException(400, f"File must be a raster image ({', '.join(allowed_types)}), got {image.content_type}")

    provider = normalize_provider(provider)
    if provider not in ("local", "tripo", "meshy", "hunyuan3d"):
        raise HTTPException(400, "provider must be local, tripo, meshy, or hunyuan3d")

    if provider == "tripo" and not os.environ.get("TRIPO_API_KEY"):
        raise HTTPException(500, "TRIPO_API_KEY environment variable is not set")
    if provider == "meshy" and not os.environ.get("MESHY_API_KEY"):
        raise HTTPException(500, "MESHY_API_KEY environment variable is not set")
    if provider == "hunyuan3d":
        raise HTTPException(501, "Hunyuan3D está listado por versão, mas o backend ainda não foi configurado")
    if provider != "hunyuan3d":
        model_version = None

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

    if provider == "tripo":
        threading.Thread(
            target=_run_cloud_inference,
            args=(job_id, str(image_path), str(output_dir), mc_resolution, model_version),
            daemon=True,
        ).start()
    elif provider == "meshy":
        threading.Thread(
            target=_run_meshy_inference,
            args=(job_id, str(image_path), str(output_dir), model_version),
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
    return {"providers": provider_catalog()}


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
    if fmt == "zip":
        path = JOBS_DIR / "connectors" / job_id / "connectors_output.zip"
    elif fmt in ("glb", "obj", "stl"):
        path = JOBS_DIR / job_id / f"model.{fmt}"
    else:
        raise HTTPException(400, "Format must be glb, obj, stl, or zip")

    if not path.exists():
        raise HTTPException(404, f"File not found: {fmt}")

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


def _run_connectors(job_id: str, mesh_path: str, output_dir: str, config: dict):
    from connectors import (
        generate_dovetail_connector, generate_plug_connector,
        generate_dowel_connector, apply_connector_to_parts, place_connectors_on_loop,
        generate_connector_at_position, CutLoop
    )
    from mesh_utils import split_mesh_by_groups, export_zip, detect_cut_loops

    try:
        update_job(job_id, "processing", progress=0, step="loading_mesh")

        logger.info(f"Connector job {job_id}: loading mesh from {mesh_path}")
        mesh = trimesh.load(mesh_path)
        if isinstance(mesh, trimesh.Scene):
            mesh = mesh.dump(concatenate=True)
        if mesh.is_empty:
            raise ValueError("Loaded mesh is empty")

        update_job(job_id, "processing", progress=10, step="detecting_boundaries")

        vertex_groups = {}
        raw_groups = config.get("vertex_groups", {})

        if raw_groups:
            first_val = next(iter(raw_groups.values()))
            if first_val and isinstance(first_val, (list, tuple)) and len(first_val) == 3 and isinstance(first_val[0], (int, float)):
                centroids = {int(k): np.array(v) for k, v in raw_groups.items()}
                verts_arr = mesh.vertices
                for vi in range(len(verts_arr)):
                    v = verts_arr[vi]
                    best_gid = min(centroids, key=lambda gid: np.linalg.norm(v - centroids[gid]))
                    if best_gid not in vertex_groups:
                        vertex_groups[best_gid] = []
                    vertex_groups[best_gid].append(vi)
                logger.info(f"Assigned {len(verts_arr)} vertices to {len(centroids)} centroids")
            else:
                for gid, verts in raw_groups.items():
                    vertex_groups[int(gid)] = verts

        connector_config = config.get("connector_config", {})
        ctype = connector_config.get("type", "dovetail")
        count = connector_config.get("count", 1)
        distribution = connector_config.get("distribution", "uniform")
        conn_size = connector_config.get("size_mm", 8.0)

        if vertex_groups:
            parts = split_mesh_by_groups(mesh, vertex_groups)
        else:
            parts = {0: mesh.copy()}

        if len(parts) < 2:
            update_job(job_id, "error", progress=0, step="error",
                       error="Need at least 2 paint groups to place connectors")
            return

        update_job(job_id, "processing", progress=30, step="splitting_mesh")

        loops = detect_cut_loops(mesh, vertex_groups)

        if not loops:
            update_job(job_id, "processing", progress=100, step="complete_no_loops",
                       files={})
            return

        update_job(job_id, "processing", progress=50, step="generating_connectors")

        placement_mode = config.get("placement_mode", "auto")
        manual_assignments = config.get("manual_assignments", {})

        if placement_mode == "manual" and manual_assignments:
            for loop_key, assignment in manual_assignments.items():
                loop_parts = loop_key.split("-")
                if len(loop_parts) == 2:
                    ga, gb = int(loop_parts[0]), int(loop_parts[1])
                    for loop in loops:
                        if loop.group_a == ga and loop.group_b == gb:
                            loop.male_on_a = assignment == "male_on_a"
                            loop.male_on_b = assignment == "male_on_b"
                            break
        else:
            assign_idx = 0
            for loop in loops:
                loop.male_on_a = (assign_idx % 2 == 0)
                loop.male_on_b = not loop.male_on_a
                assign_idx += 1

        all_dowels = []

        for loop_idx, loop in enumerate(loops):
            placements = place_connectors_on_loop(
                loop, count, distribution, conn_size
            )

            for pi, (pos, norm) in enumerate(placements):
                temp_loop = CutLoop(
                    vertices=loop.vertices,
                    normal=norm,
                    centroid=pos,
                    group_a=loop.group_a,
                    group_b=loop.group_b
                )

                if ctype == "dovetail":
                    conn = generate_dovetail_connector(temp_loop, connector_config)
                elif ctype == "plug":
                    conn = generate_plug_connector(temp_loop, connector_config)
                elif ctype == "dowel":
                    conn = generate_dowel_connector(temp_loop, connector_config)
                else:
                    raise ValueError(f"Unknown connector type: {ctype}")

                male_on_a = getattr(loop, 'male_on_a', True)
                parts, all_dowels = apply_connector_to_parts(
                    parts, conn, male_on_a, loop.group_a, loop.group_b, all_dowels
                )

            progress = 50 + int((loop_idx + 1) / len(loops) * 30)
            update_job(job_id, "processing", progress=progress,
                       step=f"connectors_loop_{loop_idx + 1}")

        update_job(job_id, "processing", progress=85, step="exporting_zip")

        for gid in parts:
            if parts[gid] is not None and not parts[gid].is_empty:
                try:
                    parts[gid].update_faces(parts[gid].unique_faces())
                    parts[gid].update_faces(parts[gid].nondegenerate_faces())
                    parts[gid].remove_unreferenced_vertices()
                except Exception:
                    pass

        zip_buf = export_zip(parts, all_dowels, config.get("model_name", "model"))

        zip_path = Path(output_dir) / "connectors_output.zip"
        with open(zip_path, "wb") as f:
            f.write(zip_buf.getvalue())

        logger.info(f"Connector job {job_id} completed → {zip_path} ({len(all_dowels)} dowels)")

        update_job(job_id, "done", progress=100, step="complete",
                   files={"zip": str(zip_path)})

    except Exception as e:
        logger.exception(f"Connector job {job_id} failed: {e}")
        import traceback
        update_job(job_id, "error", progress=0, step="error",
                   error=f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}")


@app.post("/generate-connectors")
async def generate_connectors(file: UploadFile = File(...), config: str = Form("{}"), config_json: str = None):
    import json

    config_str = config_json if config_json else config
    try:
        parsed = json.loads(config_str)
    except json.JSONDecodeError:
        raise HTTPException(400, "config must be valid JSON")

    ctype = parsed.get("connector_config", {}).get("type", "dovetail")
    if ctype not in ("dovetail", "plug", "dowel"):
        raise HTTPException(400, f"Invalid connector type: {ctype}")

    conn_dir = JOBS_DIR / "connectors"
    conn_dir.mkdir(parents=True, exist_ok=True)

    job_id = create_job()
    job_dir = conn_dir / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "mesh.stl").suffix or ".stl"
    mesh_path = job_dir / f"input{ext}"
    contents = await file.read()
    mesh_path.write_bytes(contents)

    threading.Thread(
        target=_run_connectors,
        args=(job_id, str(mesh_path), str(job_dir), parsed),
        daemon=True,
    ).start()

    return {"jobId": job_id}


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

    provider = normalize_provider(provider)
    if provider != "local":
        raise HTTPException(400, "Text-to-3D usa somente o provedor TripoSR local nesta versão.")

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
