#!/usr/bin/env python3
"""
validate_mesh.py — Manifold / watertight mesh checker using trimesh.

Runs before sending any model to a slicer (Bambu Studio, PrusaSlicer, Cura).
A failing check means the slicer will likely report errors or produce bad toolpaths.

Usage:
    python3 validate_mesh.py output/model.stl
    python3 validate_mesh.py output/model.stl --fix --save output/model_fixed.stl
    python3 validate_mesh.py output/model.stl --json   # machine-readable output
"""

import argparse
import json
import sys
from pathlib import Path

try:
    import trimesh
    import numpy as np
except ImportError:
    print("ERROR: Missing dependencies. Run: pip install trimesh numpy")
    sys.exit(1)


def validate_mesh(path: Path) -> dict[str, object]:
    """
    Run all manifold checks and return a structured result dict.
    """
    mesh = trimesh.load(str(path), force="mesh")

    results: dict[str, object] = {
        "file": str(path),
        "vertex_count": len(mesh.vertices),
        "face_count": len(mesh.faces),
        "checks": {},
        "passed": False,
    }

    checks = results["checks"]

    # 1. Watertight (no open edges)
    checks["watertight"] = {
        "pass": mesh.is_watertight,
        "detail": "All edges shared by exactly 2 faces" if mesh.is_watertight
                  else f"Open edges detected — mesh has holes",
        "fix": "Use trimesh repair or regenerate with manifold3d",
    }

    # 2. Winding consistency (consistent face normals)
    checks["winding_consistent"] = {
        "pass": mesh.is_winding_consistent,
        "detail": "All face normals point outward" if mesh.is_winding_consistent
                  else "Inconsistent normals — some faces point inward",
        "fix": "Run mesh.fix_normals() or mesh.fix_inversion()",
    }

    # 3. Volume (positive = correct winding)
    volume = float(mesh.volume)
    volume_ok = volume > 0
    checks["positive_volume"] = {
        "pass": volume_ok,
        "detail": f"Volume: {volume:.3f} mm³" + ("" if volume_ok else " (negative = inverted normals)"),
        "fix": "Invert all face normals",
    }

    # 4. No degenerate faces (zero-area triangles)
    degenerate = int(np.sum(mesh.area_faces < 1e-10))
    checks["no_degenerate_faces"] = {
        "pass": degenerate == 0,
        "detail": f"{degenerate} degenerate (zero-area) faces" if degenerate > 0
                  else "No degenerate faces",
        "fix": "Remove zero-area triangles",
    }

    # 5. No duplicate faces
    unique_faces = len(np.unique(np.sort(mesh.faces, axis=1), axis=0))
    dup_faces = len(mesh.faces) - unique_faces
    checks["no_duplicate_faces"] = {
        "pass": dup_faces == 0,
        "detail": f"{dup_faces} duplicate faces" if dup_faces > 0
                  else "No duplicate faces",
        "fix": "Use trimesh.repair.fix_mesh()",
    }

    # 6. Bounding box sanity (warn if suspiciously large or small)
    extents = mesh.bounding_box.extents
    max_dim = float(np.max(extents))
    min_dim = float(np.min(extents))
    size_ok = 0.1 < max_dim < 5000  # reasonable FDM range in mm
    checks["reasonable_size"] = {
        "pass": size_ok,
        "detail": f"Bounding box: {extents[0]:.1f} × {extents[1]:.1f} × {extents[2]:.1f} mm",
        "fix": "Check units — model may be in meters or inches instead of mm",
    }

    # Overall pass: all checks that affect slicing must pass
    critical_checks = ["watertight", "winding_consistent", "positive_volume", "no_degenerate_faces"]
    results["passed"] = all(checks[k]["pass"] for k in critical_checks)

    return results


def print_report(results: dict) -> None:
    file_path = results["file"]
    print(f"\n{'='*60}")
    print(f"  Mesh Validation: {Path(file_path).name}")
    print(f"{'='*60}")
    print(f"  Vertices: {results['vertex_count']:,}")
    print(f"  Faces:    {results['face_count']:,}")
    print()

    for check_name, check in results["checks"].items():
        status = "PASS" if check["pass"] else "FAIL"
        icon = "✓" if check["pass"] else "✗"
        print(f"  {icon} [{status}] {check_name.replace('_', ' ').title()}")
        print(f"         {check['detail']}")
        if not check["pass"]:
            print(f"         → Fix: {check['fix']}")
        print()

    overall = "PASS — ready for slicer" if results["passed"] else "FAIL — fix errors before slicing"
    icon = "✓" if results["passed"] else "✗"
    print(f"  {icon} Overall: {overall}")
    print(f"{'='*60}\n")


def attempt_fix(path: Path, save_path: Path) -> bool:
    """Attempt auto-repair with trimesh and save fixed mesh."""
    print(f"Attempting repair of {path}...")
    mesh = trimesh.load(str(path), force="mesh")

    trimesh.repair.fix_winding(mesh)
    trimesh.repair.fix_normals(mesh)
    trimesh.repair.fill_holes(mesh)

    mesh.export(str(save_path))
    print(f"Saved repaired mesh to {save_path}")
    print("Note: auto-repair is best-effort — re-validate after fixing.")
    return True


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate 3D mesh for manifold / watertight requirements."
    )
    parser.add_argument("mesh_file", help="Path to .stl or .3mf file")
    parser.add_argument("--fix", action="store_true", help="Attempt auto-repair")
    parser.add_argument("--save", help="Path to save repaired mesh (requires --fix)")
    parser.add_argument("--json", action="store_true", dest="json_output",
                        help="Output results as JSON (for scripting)")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    path = Path(args.mesh_file)

    if not path.exists():
        print(f"ERROR: File not found: {path}")
        sys.exit(1)

    results = validate_mesh(path)

    if args.json_output:
        print(json.dumps(results, indent=2))
    else:
        print_report(results)

    if args.fix:
        save_path = Path(args.save) if args.save else path.with_stem(path.stem + "_fixed")
        attempt_fix(path, save_path)
        # Re-validate after fix
        print("Re-validating repaired mesh...")
        fixed_results = validate_mesh(save_path)
        if not args.json_output:
            print_report(fixed_results)
        sys.exit(0 if fixed_results["passed"] else 1)
    else:
        sys.exit(0 if results["passed"] else 1)


if __name__ == "__main__":
    main()
