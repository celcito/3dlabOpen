import logging
import os
from typing import Optional

import numpy as np
import trimesh

logger = logging.getLogger(__name__)


def convert_glb_to_all(glb_path: str, output_dir: str) -> dict[str, str]:
    scene = trimesh.load(glb_path, force="scene")
    meshes: list[trimesh.Trimesh] = []

    if isinstance(scene, trimesh.Scene):
        for name, geom in scene.geometry.items():
            if isinstance(geom, trimesh.Trimesh):
                meshes.append(geom)
        if not meshes:
            meshes = [scene.dump(concatenate=True)]
    elif isinstance(scene, trimesh.Trimesh):
        meshes = [scene]
    else:
        raise RuntimeError(f"Unknown trimesh object type: {type(scene)}")

    merged = trimesh.util.concatenate(meshes) if len(meshes) > 1 else meshes[0]

    result: dict[str, str] = {}

    glb_out = os.path.join(output_dir, "model.glb")
    if os.path.abspath(glb_out) != os.path.abspath(glb_path):
        merged.export(glb_out)
    result["glb"] = glb_out

    obj_path = os.path.join(output_dir, "model.obj")
    merged.export(obj_path)
    result["obj"] = obj_path

    stl_path = os.path.join(output_dir, "model.stl")
    merged.export(stl_path)
    result["stl"] = stl_path

    logger.info(f"Converted to: {list(result.keys())}")
    return result
