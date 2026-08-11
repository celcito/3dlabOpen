import numpy as np
import trimesh
from dataclasses import dataclass
from math import pi, tan, radians
from shapely.geometry import Polygon as ShapelyPolygon


@dataclass
class ConnectorGeometry:
    male: trimesh.Trimesh
    female: trimesh.Trimesh
    dowel_pin: trimesh.Trimesh | None = None


@dataclass
class CutLoop:
    vertices: np.ndarray
    normal: np.ndarray
    centroid: np.ndarray
    group_a: int
    group_b: int


TOLERANCE_PRESETS = {
    "fdm_standard": {"tolerance": 0.15, "xy_compensation": 0.10},
    "fdm_tight": {"tolerance": 0.08, "xy_compensation": 0.05},
    "sla_standard": {"tolerance": 0.05, "xy_compensation": 0.02},
}


def resolve_tolerance(config: dict) -> tuple[float, float]:
    preset = config.get("tolerance_preset", "fdm_standard")
    preset_values = TOLERANCE_PRESETS.get(preset, TOLERANCE_PRESETS["fdm_standard"])
    tolerance = config.get("tolerance_mm", preset_values["tolerance"])
    xy_comp = config.get("xy_compensation_mm", preset_values["xy_compensation"])
    return tolerance, xy_comp


def create_rotation_matrix(from_vec: np.ndarray, to_vec: np.ndarray) -> np.ndarray:
    from_vec = from_vec / np.linalg.norm(from_vec)
    to_vec = to_vec / np.linalg.norm(to_vec)
    
    if np.allclose(from_vec, to_vec):
        return np.eye(3)
    if np.allclose(from_vec, -to_vec):
        return -np.eye(3)
    
    axis = np.cross(from_vec, to_vec)
    axis = axis / np.linalg.norm(axis)
    angle = np.arccos(np.clip(np.dot(from_vec, to_vec), -1.0, 1.0))
    
    K = np.array([
        [0, -axis[2], axis[1]],
        [axis[2], 0, -axis[0]],
        [-axis[1], axis[0], 0]
    ])
    R = np.eye(3) + np.sin(angle) * K + (1 - np.cos(angle)) * (K @ K)
    return R


def extrude_polygon_3d(
    vertices_2d: np.ndarray,
    height: float,
    transform: np.ndarray = None
) -> trimesh.Trimesh:
    """Extrude a 2D polygon (Z=0 plane) to 3D with given height."""
    if len(vertices_2d) < 3:
        return None
    
    if len(vertices_2d) < 3:
        return None
    
    polygon = ShapelyPolygon(vertices_2d)
    if polygon.area < 1e-10:
        return None
    
    extruded = trimesh.creation.extrude_polygon(polygon, height)
    if transform is not None:
        extruded.apply_transform(transform)
    return extruded


def polygon_from_polygon(sides: int, radius: float) -> np.ndarray:
    """Generate 2D polygon vertices for regular polygon (circumscribed circle)."""
    if sides == 3:
        angles = np.array([pi/2, 7*pi/6, 11*pi/6])
    elif sides == 4:
        angles = np.array([pi/4, 3*pi/4, 5*pi/4, 7*pi/4])
    elif sides == 6:
        angles = np.array([0, pi/3, 2*pi/3, pi, 4*pi/3, 5*pi/3])
    else:
        angles = np.linspace(0, 2*pi, sides, endpoint=False)
    return np.column_stack([radius * np.cos(angles), radius * np.sin(angles)])


def taper_polygon(vertices_2d: np.ndarray, top_scale: float) -> np.ndarray:
    center = vertices_2d.mean(axis=0)
    return center + (vertices_2d - center) * top_scale


def tapered_extrude_polygon(
    vertices_2d: np.ndarray,
    height: float,
    top_scale: float,
    transform: np.ndarray = None
) -> trimesh.Trimesh:
    """Extrude a 2D polygon into a watertight tapered solid (frustum).

    The straight prism is extruded and then the top-face vertices are scaled
    toward the polygon centroid, turning each side quad into a trapezoid.
    Returns None when the input polygon is invalid.
    """
    if len(vertices_2d) < 3:
        return None

    polygon = ShapelyPolygon(vertices_2d)
    if polygon.area < 1e-10:
        return None

    prism = trimesh.creation.extrude_polygon(polygon, height)
    if prism is None or prism.is_empty:
        return None

    if top_scale != 1.0:
        top_z = prism.bounds[1, 2]
        center = vertices_2d.mean(axis=0)
        top_idx = np.where(np.abs(prism.vertices[:, 2] - top_z) < 1e-6)[0]
        if len(top_idx):
            top_xy = prism.vertices[top_idx][:, :2]
            prism.vertices[top_idx][:, :2] = center + (top_xy - center) * top_scale

    if transform is not None:
        prism.apply_transform(transform)
    return prism


def generate_dovetail_connector(loop: CutLoop, config: dict) -> ConnectorGeometry:
    """Generate trapezoidal dovetail connector (male extrusion + female pocket)."""
    size = config["size_mm"]
    depth = config["depth_mm"]
    
    tolerance, xy_comp = resolve_tolerance(config)
    
    half_size = size / 2
    neck_fraction = config.get("dovetail_neck", 0.6)
    neck = half_size * neck_fraction
    
    normal = loop.normal / np.linalg.norm(loop.normal)
    centroid = loop.centroid
    
    R = create_rotation_matrix(np.array([0, 0, 1]), normal)
    
    male_poly = np.array([
        [-half_size, -neck],
        [half_size, -neck],
        [half_size * 0.85, neck],
        [-half_size * 0.85, neck]
    ])
    
    T = np.eye(4)
    T[:3, :3] = R
    T[:3, 3] = centroid - normal * (depth / 2)

    male = extrude_polygon_3d(male_poly, depth, T)
    if male is None:
        male = trimesh.creation.box(extents=[size, size, depth])
        male.apply_transform(T)
    
    clearance = 2 * tolerance + xy_comp
    female_poly = male_poly * (1.0 + clearance / half_size)
    
    T_f = T.copy()
    T_f[:3, 3] = centroid + normal * (tolerance / 2)
    
    female = extrude_polygon_3d(female_poly, depth + tolerance, T_f)
    if female is None:
        female = trimesh.creation.box(extents=[size*1.1, size*1.1, depth + tolerance])
        female.apply_transform(T_f)
    
    return ConnectorGeometry(male=male, female=female)


def generate_plug_connector(loop: CutLoop, config: dict) -> ConnectorGeometry:
    """Generate plug connector (polygon peg + matching hole with clearance)."""
    size = config["size_mm"]
    depth = config["depth_mm"]
    shape = config.get("plug_shape", "hexagon")
    draft_deg = config.get("draft_angle_deg", 2.0)
    
    tolerance, xy_comp = resolve_tolerance(config)
    clearance = 2 * tolerance + xy_comp
    
    sides_map = {"triangle": 3, "square": 4, "hexagon": 6, "circle": 16}
    sides = sides_map.get(shape, 6)
    
    normal = loop.normal / np.linalg.norm(loop.normal)
    centroid = loop.centroid
    
    R = create_rotation_matrix(np.array([0, 0, 1]), normal)
    T = np.eye(4)
    T[:3, :3] = R
    T[:3, 3] = centroid - normal * (depth / 2)

    base_radius = size / 2
    male_2d = polygon_from_polygon(sides, base_radius)
    
    if draft_deg > 0:
        top_scale = 1.0 - (depth * tan(radians(draft_deg)) / base_radius) * 2
        top_scale = max(top_scale, 0.5)
        male = tapered_extrude_polygon(male_2d, depth, top_scale, T)
    else:
        male = extrude_polygon_3d(male_2d, depth, T)
    
    if male is None or male.is_empty:
        male = trimesh.creation.box(extents=[size, size, depth])
        male.apply_transform(T)
    
    female_radius = base_radius + clearance / 2
    female_2d = polygon_from_polygon(sides, female_radius)
    
    T_f = T.copy()
    T_f[:3, 3] = centroid + normal * (tolerance / 2)
    
    female = extrude_polygon_3d(female_2d, depth + tolerance, T_f)
    if female is None:
        female = trimesh.creation.cylinder(radius=female_radius, height=depth + tolerance)
        female.apply_transform(T_f)
    
    return ConnectorGeometry(male=male, female=female)


def generate_dowel_connector(loop: CutLoop, config: dict) -> ConnectorGeometry:
    """Generate dowel connector (separate pin + holes in both parts)."""
    diameter = config["size_mm"]
    depth = config["depth_mm"]
    
    tolerance, xy_comp = resolve_tolerance(config)
    hole_dia = diameter + 2 * tolerance + xy_comp
    pin_length = depth * 2
    
    normal = loop.normal / np.linalg.norm(loop.normal)
    centroid = loop.centroid
    
    R = create_rotation_matrix(np.array([0, 0, 1]), normal)
    
    pin = trimesh.creation.cylinder(radius=diameter/2, height=pin_length, sections=32)
    T_pin = np.eye(4)
    T_pin[:3, :3] = R
    T_pin[:3, 3] = centroid - normal * (pin_length / 2)
    pin.apply_transform(T_pin)
    
    hole = trimesh.creation.cylinder(radius=hole_dia/2, height=depth + tolerance, sections=32)
    
    T_hole_a = np.eye(4)
    T_hole_a[:3, :3] = R
    T_hole_a[:3, 3] = centroid - normal * (depth/2 + tolerance/2)
    
    T_hole_b = np.eye(4)
    T_hole_b[:3, :3] = R
    T_hole_b[:3, 3] = centroid + normal * (depth/2 + tolerance/2)
    
    hole_a = hole.copy()
    hole_a.apply_transform(T_hole_a)
    
    hole_b = hole.copy()
    hole_b.apply_transform(T_hole_b)
    
    female_combined = trimesh.util.concatenate([hole_a, hole_b])
    
    return ConnectorGeometry(
        male=trimesh.Trimesh(),
        female=female_combined,
        dowel_pin=pin
    )


def place_connectors_on_loop(
    loop: CutLoop,
    count: int,
    distribution: str,
    connector_size: float,
    loop_length: float = None
) -> list[tuple[np.ndarray, np.ndarray]]:
    """Place connectors along a boundary loop."""
    if loop_length is None:
        verts = loop.vertices
        loop_length = sum(np.linalg.norm(verts[(i+1)%len(verts)] - verts[i]) for i in range(len(verts)))
    
    min_spacing = connector_size * 1.5
    max_count = max(1, int(loop_length / min_spacing))
    count = min(count, max_count)
    
    if count <= 0:
        return []
    
    verts = loop.vertices
    edges = [(verts[i], verts[(i+1)%len(verts)]) for i in range(len(verts))]
    edge_lengths = [np.linalg.norm(e[1] - e[0]) for e in edges]
    cum_lengths = np.cumsum([0] + edge_lengths)
    total_len = cum_lengths[-1]
    
    positions = []
    if distribution == "uniform":
        for i in range(count):
            t = (i + 0.5) / count
            target_len = t * total_len
            idx = np.searchsorted(cum_lengths, target_len) - 1
            idx = np.clip(idx, 0, len(edges) - 1)
            edge_t = (target_len - cum_lengths[idx]) / max(edge_lengths[idx], 1e-6)
            pos = edges[idx][0] + edge_t * (edges[idx][1] - edges[idx][0])
            positions.append(pos)
    elif distribution == "curvature":
        for i in range(count):
            t = (i + 0.5) / count
            target_len = t * total_len
            idx = np.searchsorted(cum_lengths, target_len) - 1
            idx = np.clip(idx, 0, len(edges) - 1)
            edge_t = (target_len - cum_lengths[idx]) / max(edge_lengths[idx], 1e-6)
            pos = edges[idx][0] + edge_t * (edges[idx][1] - edges[idx][0])
            positions.append(pos)
    else:
        for i in range(count):
            t = (i + 0.5) / count
            target_len = t * total_len
            idx = np.searchsorted(cum_lengths, target_len) - 1
            idx = np.clip(idx, 0, len(edges) - 1)
            edge_t = (target_len - cum_lengths[idx]) / max(edge_lengths[idx], 1e-6)
            pos = edges[idx][0] + edge_t * (edges[idx][1] - edges[idx][0])
            positions.append(pos)
    
    return [(pos, loop.normal) for pos in positions]


def generate_connector_at_position(
    position: np.ndarray,
    normal: np.ndarray,
    config: dict,
    loop: CutLoop = None
) -> ConnectorGeometry:
    """Generate a single connector at a specific position/normal."""
    temp_loop = CutLoop(
        vertices=np.array([position]),
        normal=normal,
        centroid=position,
        group_a=loop.group_a if loop else 0,
        group_b=loop.group_b if loop else 1
    )
    
    ctype = config["type"]
    if ctype == "dovetail":
        return generate_dovetail_connector(temp_loop, config)
    elif ctype == "plug":
        return generate_plug_connector(temp_loop, config)
    elif ctype == "dowel":
        return generate_dowel_connector(temp_loop, config)
    else:
        raise ValueError(f"Unknown connector type: {ctype}")


def apply_connector_to_parts(
    parts: dict[int, trimesh.Trimesh],
    connector: ConnectorGeometry,
    male_on_a: bool,
    group_a: int,
    group_b: int,
    dowels: list[trimesh.Trimesh]
) -> tuple[dict[int, trimesh.Trimesh], list[trimesh.Trimesh]]:
    """Apply connector geometry to the two parts via boolean operations."""
    from boolean_ops import robust_union, robust_difference
    
    part_a = parts[group_a]
    part_b = parts[group_b]
    
    if connector.dowel_pin is not None:
        dowels.append(connector.dowel_pin)
        part_a = robust_difference(part_a, connector.female)
        part_b = robust_difference(part_b, connector.female)
    else:
        if male_on_a:
            part_a = robust_union(part_a, connector.male)
            part_b = robust_difference(part_b, connector.female)
        else:
            part_a = robust_difference(part_a, connector.female)
            part_b = robust_union(part_b, connector.male)
    
    parts[group_a] = part_a
    parts[group_b] = part_b
    return parts, dowels
