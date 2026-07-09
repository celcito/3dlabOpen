#!/usr/bin/env python3
"""
BYD Dolphin Mini Card Holder — Build Script
Real dimensions: 3780 x 1715 x 1540 mm → ~1:33 scale

Dependencies: pip install manifold3d numpy

Usage:
    python3 build.py          # generates .3mf and .stl
"""

import sys
from pathlib import Path

# Use local generate_model.py (included in this directory)
sys.path.insert(0, str(Path(__file__).parent))

import manifold3d as m3d
from generate_model import export_3mf, export_stl

# ============================================================
# BYD Dolphin Mini Card Holder  (~1:33 scale)
# Real: 3780 x 1715 x 1540 mm
#
# Axes: X=width(left-right)  Y=length(front-rear)  Z=height(ground-roof)
# Cards enter from REAR (high Y), card length along Y.
# ============================================================

CARD_LEN = 85.6
CARD_WID = 54.0
CLEAR = 0.6
WALL = 2.0

CAV_L = CARD_LEN + CLEAR
CAV_W = CARD_WID + CLEAR
CAV_H = 9.0       # holds ~10 cards

BODY_W = 64.0
BODY_L = 114.0
BODY_H = 44.0
GC = 7.0            # ground clearance

WH_R = 8.5          # wheel radius
WH_W = 5.5          # wheel width
SEG = 64

# ============================================================
# CAR BODY = hood + cabin + trunk (all axis-aligned boxes)
# ============================================================
hood  = m3d.Manifold.cube([BODY_W, 30, 16], center=False).translate([0, 4, GC])
cabin = m3d.Manifold.cube([BODY_W, 50, 28], center=False).translate([0, 26, GC + 2])
trunk = m3d.Manifold.cube([BODY_W, 18, 16], center=False).translate([0, 90, GC])

body = hood + cabin + trunk

# ============================================================
# SILHOUETTE CUTS — rotate around X to slope in the YZ plane
# ============================================================

# Windshield: cut front-upper cabin at ~25° slope
ws = m3d.Manifold.cube([BODY_W + 4, 45, 45], center=False)
ws = ws.rotate([-25, 0, 0])
ws = ws.translate([-2, 27, 14])
body = body - ws

# Rear window: cut rear-upper cabin at ~30° slope  
rw = m3d.Manifold.cube([BODY_W + 4, 45, 45], center=False)
rw = rw.rotate([25, 0, 0])
rw = rw.translate([-2, 42, 14])
body = body - rw

# Front bumper/nose: steep cut at front of hood
fb = m3d.Manifold.cube([BODY_W + 4, 25, 25], center=False)
fb = fb.rotate([-38, 0, 0])
fb = fb.translate([-2, -3, 2])
body = body - fb

# Rear bumper
rb = m3d.Manifold.cube([BODY_W + 4, 20, 25], center=False)
rb = rb.rotate([38, 0, 0])
rb = rb.translate([-2, 105, 2])
body = body - rb

# ============================================================
# CARD CAVITY — centered inside the body
# ============================================================
cav_x = (BODY_W - CAV_W) / 2
cav_y = (BODY_L - CAV_L) / 2
cav_z = GC + WALL

cavity = m3d.Manifold.cube([CAV_W, CAV_L, CAV_H], center=False)
cavity = cavity.translate([cav_x, cav_y, cav_z])
body = body - cavity

# ============================================================
# CARD SLOT — rear opening cut
# ============================================================
slot_y = cav_y + CAV_L - 4
slot = m3d.Manifold.cube([CAV_W + 0.4, 8, CAV_H + 0.4], center=False)
slot = slot.translate([cav_x - 0.2, slot_y, cav_z - 0.2])
body = body - slot

# ============================================================
# WHEELS (cylinder axis X = wheel rolls forward in +Y)
# ============================================================
wheel_template = m3d.Manifold.cylinder(
    height=WH_W, radius_low=WH_R, radius_high=WH_R,
    circular_segments=SEG, center=False,
)
# rotate Z→X axis  (rotate 90° around Y)
wheel_template = wheel_template.rotate([0, 90, 0])

L = BODY_W / 2 + 2            # left wheel face start
R = -BODY_W / 2 - 2 - WH_W    # right wheel face start

for y_pos in [25, 88]:
    body = body + wheel_template.translate([L,  y_pos, WH_R])
    body = body + wheel_template.translate([R, y_pos, WH_R])

# ============================================================
# WHEEL ARCHES — subtractive cylinders above wheels
# ============================================================
arch_r = WH_R + 1.5
arch_w = WH_W + 1.0
arch_template = m3d.Manifold.cylinder(
    height=arch_w, radius_low=arch_r, radius_high=arch_r,
    circular_segments=SEG, center=False,
)
arch_template = arch_template.rotate([0, 90, 0])

for y_pos in [25, 88]:
    body = body - arch_template.translate([L, y_pos, WH_R])
    body = body - arch_template.translate([R, y_pos, WH_R])

# ============================================================
# DETAILS: side windows, headlights, taillights
# ============================================================

# Side window recess (depth 1.5mm)
win = m3d.Manifold.cube([3, 28, 13], center=False)
win_l = win.translate([BODY_W / 2 - 1.5, 39, GC + 18])
win_r = win.translate([-BODY_W / 2 - 1.5, 39, GC + 18])
body = body - win_l - win_r

# Rear quarter window
qwin = m3d.Manifold.cube([3, 16, 10], center=False)
qwin_l = qwin.translate([BODY_W / 2 - 1.5, 70, GC + 21])
qwin_r = qwin.translate([-BODY_W / 2 - 1.5, 70, GC + 21])
body = body - qwin_l - qwin_r

# Headlights (front)
hl = m3d.Manifold.cube([3, 8, 4], center=False)
hl_l = hl.translate([BODY_W / 2 - 1.5, 2, GC + 8])
hl_r = hl.translate([-BODY_W / 2 - 1.5, 2, GC + 8])
body = body - hl_l - hl_r

# Taillights (rear)
tl = m3d.Manifold.cube([3, 8, 4], center=False)
tl_l = tl.translate([BODY_W / 2 - 1.5, BODY_L - 6, GC + 8])
tl_r = tl.translate([-BODY_W / 2 - 1.5, BODY_L - 6, GC + 8])
body = body - tl_l - tl_r

# ============================================================
# EXPORT
# ============================================================
out = Path(__file__).parent
export_3mf(body, out / "dolphin_mini_cardholder.3mf", name="dolphin_mini_cardholder")
export_stl(body, out / "dolphin_mini_cardholder.stl")

x0, y0, z0, x1, y1, z1 = body.bounding_box()
print(f"BBox:  X:{x1-x0:.1f}  Y:{y1-y0:.1f}  Z:{z1-z0:.1f} mm")
print(f"Genus: {body.genus()}")
print("Done.")
