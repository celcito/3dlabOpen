import sys
import numpy as np

def _register_cpu_fallback():
    def marching_cubes(level, iso_value):
        from skimage.measure import marching_cubes as mc_sk
        device = level.device if hasattr(level, "device") else "cpu"
        volume = level.detach().cpu().numpy().astype(np.float32)
        verts, faces, _, _ = mc_sk(volume, level=iso_value)
        import torch
        return (
            torch.from_numpy(verts.copy()).float().to(device),
            torch.from_numpy(faces.astype(np.int64).copy()).to(device),
        )

    shim = type(sys)("torchmcubes")
    shim.marching_cubes = marching_cubes
    sys.modules["torchmcubes"] = shim


try:
    import torchmcubes  # noqa: F401
except ImportError:
    _register_cpu_fallback()
