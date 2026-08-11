import trimesh
import numpy as np
import logging
import io
import zipfile
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass

from connectors import CutLoop

logger = logging.getLogger(__name__)


@dataclass
class SplitPart:
    group_id: int
    mesh: trimesh.Trimesh
    name: str


def split_mesh_by_groups(
    original_mesh: trimesh.Trimesh,
    vertex_groups: Dict[int, List[int]]
) -> Dict[int, trimesh.Trimesh]:
    """Split a mesh into separate parts by vertex group assignments."""
    if not vertex_groups:
        return {0: original_mesh.copy()}
    
    all_assigned: Set[int] = set()
    for verts in vertex_groups.values():
        all_assigned.update(verts)
    
    vertex_to_face: Dict[int, List[int]] = {}
    for fi, face in enumerate(original_mesh.faces):
        for vi in face:
            if vi not in vertex_to_face:
                vertex_to_face[vi] = []
            vertex_to_face[vi].append(fi)
    
    unassigned_vertices = set(range(len(original_mesh.vertices))) - all_assigned
    
    parts: Dict[int, trimesh.Trimesh] = {}
    
    for gid, vert_indices in vertex_groups.items():
        if len(vert_indices) < 3:
            continue
        
        vertex_set = set(vert_indices)
        
        face_set: Set[int] = set()
        for vi in vertex_set:
            face_set.update(vertex_to_face.get(vi, []))
        
        valid_faces = []
        for fi in face_set:
            face = original_mesh.faces[fi]
            verts_in_group = sum(1 for v in face if v in vertex_set)
            if verts_in_group >= 2:
                valid_faces.append(fi)
        
        if not valid_faces:
            continue
        
        submesh = original_mesh.submesh([valid_faces], append=True)
        if submesh is not None and not submesh.is_empty and submesh.volume > 1e-10:
            submesh.remove_unreferenced_vertices()
            parts[gid] = _close_shell(submesh)
    
    if unassigned_vertices and len(parts) > 0:
        vertex_set = unassigned_vertices
        
        face_set: Set[int] = set()
        for vi in vertex_set:
            face_set.update(vertex_to_face.get(vi, []))
        
        assigned_faces: Set[int] = set()
        for gid, vert_indices in vertex_groups.items():
            vertex_set_g = set(vert_indices)
            for fi in list(face_set):
                face = original_mesh.faces[fi]
                verts_in_group = sum(1 for v in face if v in vertex_set_g)
                if verts_in_group >= 2:
                    assigned_faces.add(fi)
        
        unassigned_faces = face_set - assigned_faces
        
        if unassigned_faces:
            leftover = original_mesh.submesh([list(unassigned_faces)], append=True)
            if leftover is not None and not leftover.is_empty and leftover.volume > 1e-10:
                leftover.remove_unreferenced_vertices()
                next_gid = max(parts.keys()) + 1 if parts else 0
                parts[next_gid] = _close_shell(leftover)
    
    return parts


def _close_shell(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Cap the open cut boundary of a split part so CSG booleans (which require
    watertight input) work on it.

    The cap is triangulated manually with a fan and oriented to point OUTWARD
    from the solid's centroid, which is deterministic. Relying on
    ``trimesh.repair.fill_holes`` is avoided because it caps one of two mirror
    halves with an inverted winding (verified: the same fill yields 2000-667 on
    one half and 2000+667 on the other). Returns the (possibly new) mesh.
    """
    if mesh is None or mesh.is_empty or mesh.is_watertight:
        return mesh

    edges = mesh.edges
    unique_edges, inverse = np.unique(np.sort(edges, axis=1), axis=0, return_inverse=True)
    counts = np.bincount(inverse)
    boundary = [tuple(int(a) for a in e) for e in unique_edges[counts == 1]]
    if not boundary:
        return mesh

    shell_centroid = mesh.vertices.mean(axis=0)
    new_faces = []
    for loop_indices in _trace_all_loops(boundary):
        if len(loop_indices) < 3:
            continue
        loop_verts = mesh.vertices[loop_indices]
        center = loop_verts.mean(axis=0)
        normal = _plane_normal_pca(loop_verts, center)
        if np.dot(normal, center - shell_centroid) < 0:
            normal = -normal
        new_faces.append(_fan_cap_faces(loop_indices, loop_verts, center, normal))

    if new_faces:
        mesh.faces = np.concatenate([mesh.faces] + new_faces)
    return mesh


def _plane_normal_pca(loop_verts: np.ndarray, centroid: np.ndarray) -> np.ndarray:
    """Best-fit-plane normal of a loop (axis of smallest variance)."""
    centered = loop_verts - centroid
    cov = centered.T @ centered
    _, eigvecs = np.linalg.eigh(cov)
    return eigvecs[:, 0]


def _fan_cap_faces(
    loop_indices: List[int],
    loop_verts: np.ndarray,
    center: np.ndarray,
    normal: np.ndarray
) -> np.ndarray:
    """Fan-triangulate a boundary loop, wound so the cap normal equals ``normal``."""
    u = np.cross(normal, np.array([1.0, 0, 0]))
    if np.linalg.norm(u) < 1e-6:
        u = np.cross(normal, np.array([0.0, 1.0, 0]))
    u = u / np.linalg.norm(u)
    v = np.cross(normal, u)

    pts = loop_verts - center
    p2 = np.column_stack([pts @ u, pts @ v])
    n_pts = len(p2)
    d = p2[1:] - p2[0]
    signed_area = np.sum(d[:-1, 0] * d[1:, 1] - d[:-1, 1] * d[1:, 0])

    idx = np.array(loop_indices, dtype=int)
    if signed_area > 0:
        return np.column_stack([
            np.repeat(idx[0], n_pts - 2),
            idx[1:n_pts - 1],
            idx[2:n_pts]
        ])
    return np.column_stack([
        np.repeat(idx[0], n_pts - 2),
        idx[2:n_pts],
        idx[1:n_pts - 1]
    ])


def detect_cut_loops(
    original_mesh: trimesh.Trimesh,
    vertex_groups: Dict[int, List[int]]
) -> List[CutLoop]:
    """Detect boundary loops between adjacent vertex groups on the mesh.

    For each pair of groups that share a face boundary, compute the cut loop
    (vertices, normal, centroid). Faces are assigned to a group by majority of
    their vertices; an edge is a boundary edge when its two incident faces
    belong to different groups.
    """
    if not vertex_groups:
        return []

    group_of_vertex: Dict[int, int] = {}
    for gid, verts in vertex_groups.items():
        for vi in verts:
            group_of_vertex[vi] = gid

    faces = original_mesh.faces

    face_groups: Dict[int, int] = {}
    for fi, face in enumerate(faces):
        valid = [group_of_vertex[v] for v in face if v in group_of_vertex]
        if not valid:
            continue
        face_groups[fi] = max(set(valid), key=valid.count)

    edge_groups: Dict[Tuple[int, int], Set[int]] = {}
    for fi, face in enumerate(faces):
        gid = face_groups.get(fi)
        if gid is None:
            continue
        for i in range(3):
            key = (int(face[i]), int(face[(i + 1) % 3]))
            if key[0] > key[1]:
                key = (key[1], key[0])
            if key not in edge_groups:
                edge_groups[key] = set()
            edge_groups[key].add(gid)

    boundary_edges_by_pair: Dict[Tuple[int, int], List[Tuple[int, int]]] = {}
    for edge, groups in edge_groups.items():
        gset = tuple(sorted(groups))
        if len(gset) == 2:
            if gset not in boundary_edges_by_pair:
                boundary_edges_by_pair[gset] = []
            boundary_edges_by_pair[gset].append(edge)

    loops = []
    for (ga, gb), edges in boundary_edges_by_pair.items():
        for loop_indices in _trace_all_loops(edges):
            if len(loop_indices) < 3:
                continue
            loop_verts = original_mesh.vertices[loop_indices]
            centroid = loop_verts.mean(axis=0)
            normal = _plane_normal_pca(loop_verts, centroid)

            ia = [i for i in loop_indices if group_of_vertex.get(i) == ga]
            ib = [i for i in loop_indices if group_of_vertex.get(i) == gb]
            if ia and ib:
                dir_ab = original_mesh.vertices[ib].mean(axis=0) - original_mesh.vertices[ia].mean(axis=0)
                dn = np.linalg.norm(dir_ab)
                if dn > 1e-9:
                    dir_ab = dir_ab / dn
                    cos = float(np.dot(normal, dir_ab))
                    if cos < 0:
                        normal = -normal
                        cos = -cos
                    if cos < 0.3:
                        normal = dir_ab

            loops.append(CutLoop(
                vertices=loop_verts,
                normal=normal,
                centroid=centroid,
                group_a=ga,
                group_b=gb
            ))

    return loops


def _trace_all_loops(
    edges: List[Tuple[int, int]]
) -> List[List[int]]:
    """Trace a 2-regular boundary-edge set into one or more closed loops."""
    adjacency: Dict[int, List[int]] = {}
    for v1, v2 in edges:
        adjacency.setdefault(v1, []).append(v2)
        adjacency.setdefault(v2, []).append(v1)

    loops = []
    visited: Set[int] = set()

    for start in list(adjacency):
        if start in visited:
            continue
        if len(adjacency[start]) != 2:
            continue

        ordered = [start]
        visited.add(start)
        prev = start
        current = adjacency[start][0]

        while current != start:
            if current in visited:
                break
            visited.add(current)
            ordered.append(current)
            nxt = [n for n in adjacency[current] if n != prev]
            prev, current = current, (nxt[0] if nxt else start)

        if len(ordered) >= 3:
            loops.append(ordered)

    return loops


def export_zip(
    parts: Dict[int, trimesh.Trimesh],
    dowels: List[trimesh.Trimesh],
    original_name: str = "model"
) -> io.BytesIO:
    """Export parts + dowel pins as a ZIP of STL files."""
    buf = io.BytesIO()
    
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for gid, mesh in sorted(parts.items()):
            if mesh is None or mesh.is_empty:
                continue
            stl_buf = io.BytesIO()
            mesh.export(stl_buf, file_type='stl')
            fname = f"{original_name}_part_{gid}.stl"
            zf.writestr(fname, stl_buf.getvalue())
        
        for idx, dowel in enumerate(dowels):
            if dowel is None or dowel.is_empty:
                continue
            stl_buf = io.BytesIO()
            dowel.export(stl_buf, file_type='stl')
            fname = f"{original_name}_dowel_{idx}.stl"
            zf.writestr(fname, stl_buf.getvalue())
    
    buf.seek(0)
    return buf


def decimate_for_print(mesh: trimesh.Trimesh, target_faces: int = 50000) -> trimesh.Trimesh:
    """Reduce mesh face count for print export."""
    if mesh is None or mesh.is_empty:
        return mesh
    if len(mesh.faces) <= target_faces:
        return mesh
    
    try:
        ratio = target_faces / len(mesh.faces)
        return mesh.simplify_quadratic_decimation(target_faces)
    except Exception as e:
        logger.warning(f"Decimation failed: {e}")
        return mesh


def scale_and_center(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    """Scale mesh to reasonable print size and center at origin."""
    if mesh is None or mesh.is_empty:
        return mesh
    
    extent = mesh.extents
    if np.any(np.isclose(extent, 0)):
        extent = np.full(3, 1.0)
    
    max_extent = max(extent)
    if max_extent < 10:
        scale = 100.0 / max_extent
        mesh.apply_scale(scale)
    elif max_extent > 500:
        scale = 100.0 / max_extent
        mesh.apply_scale(scale)
    
    centroid = mesh.centroid
    mesh.apply_translation(-centroid)
    
    return mesh