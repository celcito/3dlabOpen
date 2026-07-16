import logging
import os

import trimesh

logger = logging.getLogger(__name__)


def decimate_mesh_file(input_path: str, output_dir: str, ratio: float) -> dict:
    mesh = trimesh.load(input_path, force="mesh")
    original_faces = len(mesh.faces)
    target_faces = max(4, int(original_faces * ratio))
    logger.info(f"Decimating {original_faces} -> {target_faces} faces (ratio={ratio})")

    decimated = mesh.simplify_quadric_decimation(target_faces)

    name = os.path.splitext(os.path.basename(input_path))[0]
    out_path = os.path.join(output_dir, f"{name}_decimated.stl")
    decimated.export(out_path)

    return {
        "path": out_path,
        "original": original_faces,
        "target": target_faces,
    }
