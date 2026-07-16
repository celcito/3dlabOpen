import json
import logging
import queue
import time
import threading
import uuid
from typing import Any, Optional

logger = logging.getLogger(__name__)

_jobs: dict[str, Any] = {}
_lock = threading.Lock()


class Job:
    def __init__(self, job_id: str):
        self.id = job_id
        self.status = "pending"
        self.progress = 0
        self.step = ""
        self.error: Optional[str] = None
        self.files: dict[str, str] = {}
        self.created_at = time.time()
        self.listeners: list[queue.Queue] = []

    def emit(self, event: str, data: dict):
        payload = f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
        dead: list[queue.Queue] = []
        for q in self.listeners:
            try:
                q.put_nowait(payload)
            except Exception:
                dead.append(q)
        for q in dead:
            try:
                self.listeners.remove(q)
            except ValueError:
                pass


def create_job() -> str:
    job_id = uuid.uuid4().hex
    with _lock:
        _jobs[job_id] = Job(job_id)
    logger.info(f"Created job {job_id}")
    return job_id


def get_job(job_id: str) -> Optional[Job]:
    with _lock:
        return _jobs.get(job_id)


def update_job(job_id: str, status: str, progress: int, step: str,
               error: Optional[str] = None, files: Optional[dict[str, str]] = None):
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.status = status
        job.progress = progress
        job.step = step
        if error is not None:
            job.error = error
        if files is not None:
            job.files = dict(files)

        job.emit("progress", {
            "status": job.status,
            "progress": job.progress,
            "step": job.step,
            "error": job.error,
            "files": job.files,
        })


def remove_old_jobs(max_age_hours: float = 24):
    now = time.time()
    with _lock:
        stale = [
            jid for jid, j in _jobs.items()
            if now - j.created_at > max_age_hours * 3600
        ]
        for jid in stale:
            del _jobs[jid]
    if stale:
        logger.info(f"Removed {len(stale)} stale jobs")
