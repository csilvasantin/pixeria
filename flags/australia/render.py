#!/usr/bin/env python3
"""Australian flag as monospaced ASCII, rendered to SVG and PNG.

Layout follows the official 1:2 construction:
- Union Jack in the canton (upper hoist quarter)
- Commonwealth Star (7 points) centred in the lower hoist quarter
- Southern Cross in the fly: α β γ δ (7 points) + ε Ginan (5 points)
"""
from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 160, 80  # character cells, 1:2
CELL = 10
NAVY = "#012169"
RED = "#E4002B"
WHITE = "#FFFFFF"
NAVY_RGB = (1, 33, 105)
RED_RGB = (228, 0, 43)
WHITE_RGB = (255, 255, 255)

# Character alphabet stays 7-bit ASCII so alignment is font-stable.
CH_BLUE = "."
CH_WHITE = "@"
CH_RED = "#"
CH_STAR = "*"


def dist_to_line(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    dx, dy = x2 - x1, y2 - y1
    length = math.hypot(dx, dy) or 1.0
    return abs((py - y1) * dx - (px - x1) * dy) / length


def side_of_line(px: float, py: float, x1: float, y1: float, x2: float, y2: float) -> float:
    return (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1)


def star_polygon(cx: float, cy: float, r_outer: float, points: int, rotation: float) -> list[tuple[float, float]]:
    r_inner = r_outer * (0.38 if points == 7 else 0.40)
    poly = []
    for i in range(points * 2):
        ang = rotation + i * math.pi / points
        r = r_outer if i % 2 == 0 else r_inner
        poly.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    return poly


def point_in_poly(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y):
            denom = (yj - yi) or 1e-12
            if x < (xj - xi) * (y - yi) / denom + xi:
                inside = not inside
        j = i
    return inside


def union_jack_color(x: float, y: float, w: float, h: float) -> str:
    """Return R/W/B for a pixel in a 2:1 Union Jack (canton)."""
    # Construction relative to flag height (official proportions).
    red_cross = h * 0.20          # St George red = 1/5 height
    white_fimb = h * (1.0 / 15.0) # white around St George
    white_saltire = h * 0.20      # St Andrew white = 1/5 height
    red_saltire = h * (1.0 / 15.0)
    red_fimb = h * (1.0 / 30.0)

    cx, cy = w / 2.0, h / 2.0

    # St George's cross sits on top of the saltires.
    on_red_cross = abs(x - cx) <= red_cross / 2.0 or abs(y - cy) <= red_cross / 2.0
    on_white_cross = abs(x - cx) <= red_cross / 2.0 + white_fimb or abs(y - cy) <= red_cross / 2.0 + white_fimb
    if on_red_cross:
        return "R"
    if on_white_cross:
        return "W"

    # Two diagonals of the saltire.
    d1 = dist_to_line(x, y, 0, 0, w, h)       # NW → SE
    d2 = dist_to_line(x, y, 0, h, w, 0)       # SW → NE
    s1 = side_of_line(x, y, 0, 0, w, h)
    s2 = side_of_line(x, y, 0, h, w, 0)

    half_white = white_saltire / 2.0
    half_red = red_saltire / 2.0
    # St Patrick's red is offset anticlockwise relative to St Andrew's white.
    # Anticlockwise: positive side of NW-SE in the upper-right/lower-left, etc.
    # Split each diagonal into two halves at the centre.
    in_white_diag = d1 <= half_white or d2 <= half_white
    in_red_core = d1 <= half_red or d2 <= half_red

    if in_red_core:
        # Keep red only on the anticlockwise half of each diagonal.
        if d1 <= half_red:
            upper = y < cy
            if (upper and s1 > 0) or ((not upper) and s1 < 0):
                return "R"
        if d2 <= half_red:
            upper = y < cy
            if (upper and s2 > 0) or ((not upper) and s2 < 0):
                return "R"

    if in_white_diag:
        return "W"
    return "B"


def build_grid() -> list[list[tuple[str, str]]]:
    """Each cell is (char, color) with color in {B, R, W}."""
    grid = [[(CH_BLUE, "B") for _ in range(W)] for _ in range(H)]

    canton_w, canton_h = W / 2.0, H / 2.0
    for row in range(H // 2):
        for col in range(W // 2):
            color = union_jack_color(col + 0.5, row + 0.5, canton_w, canton_h)
            ch = CH_RED if color == "R" else CH_WHITE if color == "W" else CH_BLUE
            grid[row][col] = (ch, color)

    # Official centres on a 180×90 unit sheet, scaled to W×H.
    def ux(u: float) -> float:
        return u / 180.0 * W

    def uy(u: float) -> float:
        return u / 90.0 * H

    stars = [
        # Commonwealth Star — 7 points, larger, lower hoist.
        (ux(45), uy(67.5), ux(27) / 2.0, 7, CH_STAR),
        # Southern Cross
        (ux(135), uy(18), ux(180 / 14) / 2.0, 7, CH_STAR),   # γ Gacrux (top)
        (ux(108), uy(45), ux(180 / 14) / 2.0, 7, CH_STAR),   # β Mimosa (left)
        (ux(157.5), uy(40.5), ux(180 / 14) / 2.0, 7, CH_STAR),  # δ (right)
        (ux(135), uy(72), ux(180 / 14) / 2.0, 7, CH_STAR),   # α Acrux (bottom)
        (ux(144), uy(49.5), ux(180 / 24) / 2.0, 5, CH_STAR),  # ε Ginan
    ]

    for cx, cy, radius, points, ch in stars:
        poly = star_polygon(cx, cy, radius, points, rotation=-math.pi / 2)
        r_box = int(math.ceil(radius)) + 1
        col0 = max(0, int(cx) - r_box)
        col1 = min(W, int(cx) + r_box + 1)
        row0 = max(0, int(cy) - r_box)
        row1 = min(H, int(cy) + r_box + 1)
        for row in range(row0, row1):
            for col in range(col0, col1):
                if point_in_poly(col + 0.5, row + 0.5, poly):
                    grid[row][col] = (ch, "W")
    return grid


def ascii_text(grid: list[list[tuple[str, str]]]) -> str:
    return "\n".join("".join(ch for ch, _ in row) for row in grid) + "\n"


def write_svg(grid: list[list[tuple[str, str]]], path: Path) -> None:
    width_px = W * CELL
    height_px = H * CELL
    fills = {"B": NAVY, "R": RED, "W": WHITE}
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width_px}" height="{height_px}" viewBox="0 0 {width_px} {height_px}" role="img" aria-label="Australian flag in monospaced ASCII art">',
        f'<title>Australian flag · ASCII · SmithMBP16</title>',
        f'<rect width="100%" height="100%" fill="{NAVY}"/>',
        f'<style>text{{font-family:ui-monospace,Menlo,"Courier New",monospace;font-size:{CELL}px;font-weight:700;white-space:pre}}</style>',
    ]
    # Paint coloured cells first so the flag reads at a glance, then overlay
    # the ASCII glyphs without shifting the grid.
    for row_i, row in enumerate(grid):
        for col_i, (ch, color) in enumerate(row):
            if color != "B":
                parts.append(
                    f'<rect x="{col_i * CELL}" y="{row_i * CELL}" width="{CELL}" height="{CELL}" fill="{fills[color]}"/>'
                )
    # One text node per row keeps character advance identical across the line.
    for row_i, row in enumerate(grid):
        chars = "".join(ch for ch, _ in row)
        y = row_i * CELL + CELL - 2
        parts.append(
            f'<text x="0" y="{y}" fill="rgba(255,255,255,0.28)" xml:space="preserve">{chars}</text>'
        )
    parts.append("</svg>")
    path.write_text("\n".join(parts), encoding="utf-8")


def write_png(grid: list[list[tuple[str, str]]], path: Path) -> None:
    img = Image.new("RGB", (W * CELL, H * CELL), NAVY_RGB)
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype("/System/Library/Fonts/Menlo.ttc", CELL, index=1)
    fills = {"B": NAVY_RGB, "R": RED_RGB, "W": WHITE_RGB}
    for row_i, row in enumerate(grid):
        for col_i, (ch, color) in enumerate(row):
            x, y = col_i * CELL, row_i * CELL
            draw.rectangle([x, y, x + CELL - 1, y + CELL - 1], fill=fills[color])
            # Glyph overlay keeps the artefact as ASCII even in the bitmap.
            glyph_fill = (220, 230, 255) if color == "B" else (20, 24, 40)
            draw.text((x + 1, y - 1), ch, fill=glyph_fill, font=font)
    img.save(path, "PNG", optimize=True)


def main() -> None:
    here = Path(__file__).resolve().parent
    assets = here.parents[1] / "assets" / "flags"
    assets.mkdir(parents=True, exist_ok=True)
    grid = build_grid()
    (here / "australia.txt").write_text(ascii_text(grid), encoding="utf-8")
    write_svg(grid, assets / "australia-ascii.svg")
    write_png(grid, assets / "australia-ascii.png")
    write_svg(grid, here / "australia-ascii.svg")
    write_png(grid, here / "australia-ascii.png")
    print(f"grid {W}x{H}")
    print(f"wrote {assets / 'australia-ascii.svg'}")
    print(f"wrote {assets / 'australia-ascii.png'}")


if __name__ == "__main__":
    main()
