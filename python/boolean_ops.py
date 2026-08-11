import trimesh
import numpy as np
import logging
from typing import Tuple, Optional, List

logger = logging.getLogger(__name__)


def _boolean_op(
    op: str,
    mesh_a: trimesh.Trimesh,
    mesh_b: trimesh.Trimesh
) -> Optional[trimesh.Trimesh]:
    """Try boolean operation with multiple engines."""
    engines = ['manifold', 'scad', 'blender']
    for eng in engines:
        try:
            if op == 'union':
                result = trimesh.boolean.union([mesh_a, mesh_b], engine=eng)
            elif op == 'difference':
                result = trimesh.boolean.difference([mesh_a, mesh_b], engine=eng)
            elif op == 'intersection':
                result = trimesh.boolean.intersection([mesh_a, mesh_b], engine=eng)
            else:
                return None
            if result is not None and not result.is_empty:
                return _ensure_watertight(result)
        except Exception as e:
            logger.debug(f"{eng} {op} failed: {e}")
    return None


def robust_union(mesh_a: trimesh.Trimesh, mesh_b: trimesh.Trimesh) -> trimesh.Trimesh:
    """Boolean union with multiple fallback engines."""
    if mesh_a is None or mesh_b is None:
        return mesh_a or mesh_b
    
    if mesh_a.is_empty or mesh_b.is_empty:
        return mesh_a if not mesh_a.is_empty else mesh_b
    
    result = _boolean_op('union', mesh_a, mesh_b)
    if result is not None:
        return result
    
    logger.warning("Trimesh union failed, using manual concatenation fallback")
    return _manual_union(mesh_a, mesh_b)


def robust_difference(mesh_a: trimesh.Trimesh, mesh_b: trimesh.Trimesh) -> trimesh.Trimesh:
    """Boolean difference (A - B) with fallback engines."""
    if mesh_a is None or mesh_a.is_empty:
        return trimesh.Trimesh()
    
    if mesh_b is None or mesh_b.is_empty:
        return mesh_a.copy()
    
    result = _boolean_op('difference', mesh_a, mesh_b)
    if result is not None:
        return result
    
    logger.warning("Trimesh difference failed, returning original mesh")
    return _manual_difference(mesh_a, mesh_b)


def robust_intersection(mesh_a: trimesh.Trimesh, mesh_b: trimesh.Trimesh) -> trimesh.Trimesh:
    """Boolean intersection with fallback engines."""
    if mesh_a is None or mesh_b is None:
        return trimesh.Trimesh()
    
    result = _boolean_op('intersection', mesh_a, mesh_b)
    if result is not None:
        return result
    
    logger.warning("Trimesh intersection failed, returning empty")
    return trimesh.Trimesh()


def _ensure_watertight(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Repair mesh normals/winding. Does NOT fill holes: filling would re-close
    intended through-holes cut by connector differences."""
    if mesh is None or mesh.is_empty:
        return trimesh.Trimesh()
    
    try:
        mesh = mesh.copy()
        mesh.update_faces(mesh.unique_faces())
        mesh.update_faces(mesh.nondegenerate_faces())
        mesh.remove_unreferenced_vertices()
        
        # fix_normals/fix_winding in-place e retornam None no trimesh 4.x
        trimesh.repair.fix_normals(mesh)
        trimesh.repair.fix_winding(mesh)
        
        return mesh
    except Exception as e:
        logger.warning(f"Watertight repair failed: {e}")
        return mesh


def _manual_union(mesh_a: trimesh.Trimesh, mesh_b: trimesh.Trimesh) -> trimesh.Trimesh:
    """Fallback: simple vertex concatenation (for simple cases only)."""
    try:
        return trimesh.util.concatenate([mesh_a, mesh_b])
    except Exception:
        return mesh_a.copy()


def _manual_difference(mesh_a: trimesh.Trimesh, mesh_b: trimesh.Trimesh) -> trimesh.Trimesh:
    """Fallback: return mesh_a unchanged (conservative). Logs an error because a
    silent no-op difference produces parts with the hole never cut."""
    logger.error(
        "No boolean engine produced a difference result. Install one engine: "
        "`pip install manifold3d` (pure pip), OpenSCAD, or Blender. "
        "Returning base mesh unchanged."
    )
    return mesh_a.copy()


def batch_union(meshes: List[trimesh.Trimesh]) -> trimesh.Trimesh:
    """Union multiple meshes efficiently."""
    valid = [m for m in meshes if m is not None and not m.is_empty]
    if not valid:
        return trimesh.Trimesh()
    if len(valid) == 1:
        return valid[0]
    
    result = valid[0]
    for m in valid[1:]:
        result = robust_union(result, m)
    return result


def batch_difference(base: trimesh.Trimesh, cutters: List[trimesh.Trimesh]) -> trimesh.Trimesh:
    """Apply multiple difference operations to base mesh."""
    result = base
    for cutter in cutters:
        if cutter is not None and not cutter.is_empty:
            result = robust_difference(result, cutter)
    return result


def check_boolean_result(mesh: trimesh.Trimesh, operation: str) -> bool:
    """Validate boolean operation result."""
    if mesh is None or mesh.is_empty:
        logger.error(f"{operation}: Result is empty")
        return False
    if len(mesh.faces) == 0:
        logger.error(f"{operation}: No faces in result")
        return False
    if mesh.volume <= 1e-10:
        logger.warning(f"{operation}: Near-zero volume ({mesh.volume})")
    return True