#!/usr/bin/env python3
"""
generate_model.py — Parametric 3D model generator using manifold3d.

manifold3d guarantees all boolean operations produce manifold (watertight) output,
eliminating the "N non-manifold edges" errors seen with numpy-stl or raw STL tools.

See references/tolerances.md for fit clearances and dimensional compensation.
See references/formats.md for 3MF vs STL guidance.
See references/manifold-examples.md for advanced API usage.

Usage:
    python3 generate_model.py --help
    python3 generate_model.py --preset cube --output output/
    python3 generate_model.py --outer-diameter 67.5 --inner-diameter 58.0 \
                               --height 8.0 --name lens_ring --output output/

Component library (import in custom build scripts):
    from generate_model import (
        snap_tab, thread_profile, chamfered_cylinder,
        make_hollow_cylinder, make_box_with_hole,
        export_3mf, export_stl,
    )
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import manifold3d as m3d
    import numpy as np
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install manifold3d numpy")
    sys.exit(1)


def make_hollow_cylinder(
    outer_radius: float,
    inner_radius: float,
    height: float,
    segments: int = 64,
) -> m3d.Manifold:
    """
    Hollow cylinder (tube/ring).
    All units in millimeters.
    Tolerance note: FDM holes print smaller — caller should pre-compensate
    inner_radius by adding +0.1–0.2mm (see references/tolerances.md).
    """
    outer = m3d.Manifold.cylinder(
        height=height,
        radius_low=outer_radius,
        radius_high=outer_radius,
        circular_segments=segments,
    )
    inner = m3d.Manifold.cylinder(
        height=height + 0.2,  # slight overshoot to avoid z-fighting
        radius_low=inner_radius,
        radius_high=inner_radius,
        circular_segments=segments,
    )
    # Boolean subtract — manifold3d guarantees watertight output
    return outer - inner.translate([0, 0, -0.1])


def make_box_with_hole(
    width: float,
    depth: float,
    height: float,
    hole_diameter: float = 0.0,
    hole_compensation: float = 0.15,  # see references/tolerances.md
) -> m3d.Manifold:
    """
    Rectangular box with optional through-hole on Z axis.
    hole_compensation: adds to hole radius to compensate FDM shrinkage.
    """
    box = m3d.Manifold.cube([width, depth, height], center=True)

    if hole_diameter > 0:
        hole_radius = (hole_diameter / 2) + hole_compensation
        hole = m3d.Manifold.cylinder(
            height=height + 0.2,
            radius_low=hole_radius,
            radius_high=hole_radius,
            circular_segments=32,
        )
        hole = hole.translate([0, 0, -0.1])
        return box - hole

    return box


def make_calibration_cube(size: float = 20.0) -> m3d.Manifold:
    """
    20mm calibration cube — standard for tuning flow rate and dimensional accuracy.
    """
    return m3d.Manifold.cube([size, size, size])


# ---------------------------------------------------------------------------
# Component library — import these in custom build scripts
# ---------------------------------------------------------------------------

def snap_tab(
    length: float = 8.0,
    width: float = 4.0,
    thickness: float = 1.5,
    hook_depth: float = 0.8,
    hook_angle_deg: float = 30.0,
) -> m3d.Manifold:
    """
    Cantilevered snap-fit tab. Deflects along X axis.

    Design notes (see references/tolerances.md):
    - thickness 1.5mm = 3 perimeters at 0.4mm nozzle (minimum functional)
    - Print with tab deflection direction along XY, NOT Z — XY layers are stronger
    - For enclosure wall attachment, place base of tab flush with inner wall face

    Args:
        length:       Cantilever beam length (mm)
        width:        Tab width in Y direction (mm)
        thickness:    Beam thickness (mm) — min 1.2mm (3 perimeters)
        hook_depth:   Hook engagement depth (mm) — 0.6–1.0mm typical
        hook_angle_deg: Hook ramp angle — shallower = easier to release

    Returns:
        Manifold with base at origin, beam extending in +X, hook at tip
    """
    # Cantilever beam
    beam = m3d.Manifold.cube([length, width, thickness])

    # Hook wedge: ramp profile [base, tip, top-of-beam]
    ramp_profile = m3d.CrossSection([
        [0.0, 0.0],
        [hook_depth, 0.0],
        [0.0, thickness],
    ])
    ramp = m3d.Manifold.extrude(ramp_profile, height=width)
    # Rotate so it extrudes in Y and sits on tip of beam
    ramp = ramp.rotate([90, 0, 0]).translate([length, width, 0])

    return beam + ramp


def thread_profile(
    major_radius: float,
    minor_radius: float,
    pitch: float,
    turns: int,
    segments: int = 64,
) -> m3d.Manifold:
    """
    Approximate external thread as stacked revolved triangular rings.
    Good enough for FDM — real helix threads require post-processing in slicer.

    Design notes:
    - Minimum reliable thread: M3 (major_radius=1.5, minor_radius=1.19, pitch=0.5)
    - M2 is technically possible but fragile (see references/design-rules.md)
    - Add +0.1–0.15mm to major_radius for FDM hole compensation on mating part

    Args:
        major_radius:  Outer thread radius (mm)
        minor_radius:  Root/valley radius (mm) — typically major - pitch*0.6
        pitch:         Distance between thread crests (mm)
        turns:         Number of thread turns
        segments:      Circle segments per revolution

    Returns:
        Manifold thread solid, base at Z=0, height = pitch * turns
    """
    rings: list[m3d.Manifold] = []
    for i in range(turns):
        z0 = i * pitch
        z_mid = z0 + pitch * 0.5
        z1 = z0 + pitch
        # Triangle profile: valley → crest → valley
        profile = m3d.CrossSection([
            [minor_radius, z0],
            [major_radius, z_mid],
            [minor_radius, z1],
        ])
        ring = m3d.Manifold.revolve(profile, circular_segments=segments)
        rings.append(ring)

    result = rings[0]
    for r in rings[1:]:
        result = result + r
    return result


def chamfered_cylinder(
    radius: float,
    height: float,
    chamfer: float = 0.4,
    segments: int = 64,
    bottom: bool = True,
    top: bool = False,
) -> m3d.Manifold:
    """
    Cylinder with chamfer at bottom and/or top edge.

    Chamfering the bottom edge (Z=0) prevents elephant foot artefacts —
    the first layer squish widens the base; a 0.2–0.4mm chamfer compensates.
    See references/design-rules.md § Elephant Foot.

    Args:
        radius:   Cylinder radius (mm)
        height:   Total height including chamfer (mm)
        chamfer:  Chamfer width and height (mm) — 0.4mm = 1 layer at 0.4mm height
        segments: Circle segments
        bottom:   Apply chamfer at Z=0 (recommended: True)
        top:      Apply chamfer at Z=height

    Returns:
        Manifold cylinder with chamfered edges
    """
    # Build revolved profile
    r, h, c = radius, height, chamfer
    pts = []

    if bottom:
        pts += [[r - c, 0.0], [r, c]]       # bottom chamfer
    else:
        pts += [[r, 0.0]]

    if top:
        pts += [[r, h - c], [r - c, h]]     # top chamfer
    else:
        pts += [[r, h]]

    # Close the profile through the axis
    pts += [[0.0, h], [0.0, 0.0]]

    profile = m3d.CrossSection(pts)
    return m3d.Manifold.revolve(profile, circular_segments=segments)


def chamfered_box(
    width: float,
    depth: float,
    height: float,
    chamfer: float = 0.4,
    bottom: bool = True,
    top: bool = False,
) -> m3d.Manifold:
    """
    Rectangular box with chamfered bottom and/or top edges.
    Useful for all flat-bottom prints to mitigate elephant foot.

    Args:
        width, depth, height: Box outer dimensions (mm)
        chamfer: Chamfer size (mm) — 0.4mm is one layer height
        bottom:  Chamfer at Z=0
        top:     Chamfer at Z=height
    """
    box = m3d.Manifold.cube([width, depth, height])

    if bottom:
        # Subtract a thin ring around the base perimeter
        outer = m3d.Manifold.cube([width + 0.2, depth + 0.2, chamfer])
        inner = m3d.Manifold.cube([width - chamfer * 2, depth - chamfer * 2, chamfer + 0.1])
        inner = inner.translate([chamfer, chamfer, -0.05])
        ring = outer.translate([-0.1, -0.1, 0]) - inner
        # Clip to 45° chamfer shape using a scaled subtract
        chamfer_cut = m3d.Manifold.extrude(
            m3d.CrossSection([[0, 0], [chamfer, 0], [0, chamfer]]),
            height=width + depth,
        )
        # Simple approach: just cut a small bevel using the cylinder chamfer as guide
        # For boxes, offset the cross-section
        cs = m3d.CrossSection.square([width, depth])
        cs_inner = cs.offset(-chamfer, m3d.JoinType.Miter)
        bevel_top = m3d.Manifold.extrude(cs, height=0.01)
        bevel_bot = m3d.Manifold.extrude(cs_inner, height=0.01).translate([chamfer, chamfer, chamfer])
        bevel = m3d.Manifold.hull([bevel_bot, bevel_top])
        box = box - (m3d.Manifold.cube([width, depth, chamfer]) - bevel)

    if top:
        cs = m3d.CrossSection.square([width, depth])
        cs_inner = cs.offset(-chamfer, m3d.JoinType.Miter)
        bevel_top = m3d.Manifold.extrude(cs, height=0.01).translate([0, 0, height])
        bevel_bot = m3d.Manifold.extrude(cs_inner, height=0.01).translate(
            [chamfer, chamfer, height - chamfer]
        )
        bevel = m3d.Manifold.hull([bevel_bot, bevel_top])
        top_block = m3d.Manifold.cube([width, depth, chamfer]).translate([0, 0, height - chamfer])
        box = box - (top_block - bevel)

    return box


PRESETS = {
    "cube": lambda: make_calibration_cube(20.0),
    "tube": lambda: make_hollow_cylinder(
        outer_radius=15.0, inner_radius=12.0, height=20.0
    ),
    "bracket": lambda: make_box_with_hole(
        width=40.0, depth=20.0, height=10.0, hole_diameter=5.0
    ),
}


def export_stl(manifold: m3d.Manifold, path: Path) -> None:
    """Export to binary STL."""
    mesh = manifold.to_mesh()
    verts = np.array(mesh.vert_properties)
    tris = np.array(mesh.tri_verts)

    path.parent.mkdir(parents=True, exist_ok=True)

    # Write binary STL
    num_tris = len(tris)
    with open(path, "wb") as f:
        f.write(b"\x00" * 80)  # header
        f.write(num_tris.to_bytes(4, "little"))
        for tri in tris:
            v0, v1, v2 = verts[tri[0]][:3], verts[tri[1]][:3], verts[tri[2]][:3]
            # Compute face normal
            edge1 = v1 - v0
            edge2 = v2 - v0
            normal = np.cross(edge1, edge2)
            norm_len = np.linalg.norm(normal)
            if norm_len > 0:
                normal = normal / norm_len
            f.write(normal.astype(np.float32).tobytes())
            f.write(v0.astype(np.float32).tobytes())
            f.write(v1.astype(np.float32).tobytes())
            f.write(v2.astype(np.float32).tobytes())
            f.write(b"\x00\x00")  # attribute byte count

    print(f"  STL: {path} ({num_tris} triangles)")


def export_3mf(manifold: m3d.Manifold, path: Path, name: str = "model") -> None:
    """
    Export to 3MF (ISO/IEC 25422:2025).
    3MF is the preferred format: manifold-safe, Bambu/Prusa/Cura compatible.
    See references/formats.md.
    """
    import zipfile
    import xml.etree.ElementTree as ET

    mesh = manifold.to_mesh()
    verts = np.array(mesh.vert_properties)
    tris = np.array(mesh.tri_verts)

    path.parent.mkdir(parents=True, exist_ok=True)

    # Build 3MF XML
    ns = "http://schemas.microsoft.com/3dmanufacturing/core/2015/02"
    root = ET.Element("model", attrib={
        "unit": "millimeter",
        "xml:lang": "en-US",
        "xmlns": ns,
    })
    resources = ET.SubElement(root, "resources")
    obj = ET.SubElement(resources, "object", attrib={"id": "1", "type": "model", "name": name})
    mesh_el = ET.SubElement(obj, "mesh")

    vertices_el = ET.SubElement(mesh_el, "vertices")
    for v in verts:
        ET.SubElement(vertices_el, "vertex", attrib={
            "x": f"{v[0]:.6f}",
            "y": f"{v[1]:.6f}",
            "z": f"{v[2]:.6f}",
        })

    triangles_el = ET.SubElement(mesh_el, "triangles")
    for tri in tris:
        ET.SubElement(triangles_el, "triangle", attrib={
            "v1": str(tri[0]),
            "v2": str(tri[1]),
            "v3": str(tri[2]),
        })

    build = ET.SubElement(root, "build")
    ET.SubElement(build, "item", attrib={"objectid": "1"})

    xml_str = ET.tostring(root, encoding="unicode", xml_declaration=True)

    content_types = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>'
        '</Types>'
    )

    rels = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Target="/3D/model.model" Id="rel0" '
        'Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>'
        '</Relationships>'
    )

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("3D/model.model", xml_str)

    print(f"  3MF: {path} ({len(tris)} triangles) [primary output]")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate manifold 3D models for FDM printing."
    )
    parser.add_argument("--name", default="model", help="Output file base name")
    parser.add_argument("--output", default="output/", help="Output directory")
    parser.add_argument("--preset", choices=list(PRESETS.keys()), help="Use a preset shape")
    parser.add_argument("--outer-diameter", type=float, help="Outer diameter (mm)")
    parser.add_argument("--inner-diameter", type=float, help="Inner diameter (mm)")
    parser.add_argument("--width", type=float, help="Box width (mm)")
    parser.add_argument("--depth", type=float, help="Box depth (mm)")
    parser.add_argument("--height", type=float, help="Height (mm)")
    parser.add_argument("--hole-diameter", type=float, default=0.0, help="Through-hole diameter (mm)")
    parser.add_argument("--specs-file", help="JSON file from search_specs.py")
    return parser.parse_args()


def load_specs(specs_file: str) -> dict:
    with open(specs_file) as f:
        return json.load(f)


def main() -> None:
    args = parse_args()

    output_dir = Path(args.output)

    # Load specs from search_specs.py if provided
    specs = {}
    if args.specs_file:
        specs = load_specs(args.specs_file)
        print(f"Loaded specs from {args.specs_file}: {specs}")

    # Build geometry
    if args.preset:
        print(f"Using preset: {args.preset}")
        geometry = PRESETS[args.preset]()
    elif args.outer_diameter and args.inner_diameter and args.height:
        geometry = make_hollow_cylinder(
            outer_radius=args.outer_diameter / 2,
            inner_radius=args.inner_diameter / 2,
            height=args.height,
        )
    elif args.width and args.depth and args.height:
        geometry = make_box_with_hole(
            width=args.width,
            depth=args.depth,
            height=args.height,
            hole_diameter=args.hole_diameter,
        )
    else:
        print("No shape specified. Use --preset or provide dimensions.")
        print("Example: --preset cube")
        print("Example: --outer-diameter 30 --inner-diameter 25 --height 10")
        sys.exit(1)

    print(f"\nGenerating model: {args.name}")
    stl_path = output_dir / f"{args.name}.stl"
    tmf_path = output_dir / f"{args.name}.3mf"

    export_3mf(geometry, tmf_path, name=args.name)
    export_stl(geometry, stl_path)

    print(f"\nDone. Validate with:")
    print(f"  python3 scripts/validate_mesh.py {stl_path}")


if __name__ == "__main__":
    main()
