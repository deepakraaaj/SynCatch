#!/usr/bin/env python3
"""Build Lumi's two page-mascot sprite sheets from the normalized artwork.

page-mascot (https://github.com/nilbuild/page-mascot) shows a character as two
3x3 sheets: nine head directions and nine reactions. This script makes both
from Lumi's own art in src/assets/lumi (written by normalize-lumi-assets.py),
so nothing is redrawn:

  directions  neutral.webp with the head turned toward each of the eight
              directions (plus centre). The head is bent across the chin line,
              never cut, and the body stays planted. The irises glance the same
              way inside their sockets.
  reactions   the cell order page-mascot expects (blink, heart, sparkle,
              surprised, wink, bashful, sleepy, dizzy, delighted), filled with
              Lumi's expressions. Blink is neutral with the eyelids closed.

Outputs: src/assets/lumi-mascot/{directions,reactions}.webp and
design/lumi/mascot-sheets.png (the visual check). Requires numpy and Pillow.

Usage: python3 scripts/build-lumi-mascot.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ART_DIR = ROOT / 'src' / 'assets' / 'lumi'
OUT_DIR = ROOT / 'src' / 'assets' / 'lumi-mascot'
CHECK_PATH = ROOT / 'design' / 'lumi' / 'mascot-sheets.png'

CANVAS = 512
CELL = 384  # 2x the largest on-screen size, so the hero stays sharp

# Measured on neutral.webp by normalize-lumi-assets.py (512px canvas).
PIVOT = (254.5, 359.0)  # neck: the head turns around here and bends across this chin line
BEND_ABOVE, BEND_BELOW = 55, 26
EYES = [
    {'cx': 210.0, 'cy': 296.6, 'rx': 15.5, 'ry': 18.9, 'skin': (0xFC, 0xE7, 0xC1)},
    {'cx': 293.5, 'cy': 293.6, 'rx': 15.5, 'ry': 18.9, 'skin': (0xFD, 0xF1, 0xCD)},
]

# Head pose per unit of direction. The cell is chosen by angle, so each turn
# must read at a glance: tilt toward the pointer, slide the head and glance.
TURN_DEG = 9.0
SHIFT = (11.0, 8.0)
GLANCE = (0.3, 0.24)  # iris travel as a fraction of the eye radius
SOCKET_INSET = 0.86  # the shifted iris shows only inside this much of the eye

LID_MARGIN = 6.5
LASH_COLOR = (0x2A, 0x1F, 0x24)
LASH_WIDTH = 5

# page-mascot's fixed cell order, row by row.
DIRECTIONS = [(-1, -1), (0, -1), (1, -1), (-1, 0), (0, 0), (1, 0), (-1, 1), (0, 1), (1, 1)]
REACTIONS = {
    'blink': None,  # neutral, eyes closed (built below)
    'heart': 'happy',
    'sparkle': 'excited',
    'surprised': 'focused',
    'wink': 'encouraging',
    'bashful': 'calm',
    'sleepy': 'sleeping',
    'dizzy': 'encouraging',  # four quick boops: Lumi winks and waves rather than looking unwell
    'delighted': 'celebrating',
}


def load(name: str) -> np.ndarray:
    return np.asarray(Image.open(ART_DIR / f'{name}.webp').convert('RGBA'), dtype=np.float32) / 255


def sample(rgba: np.ndarray, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    """Bilinear sample with premultiplied alpha so edges do not pick up dark fringes."""
    pre = rgba.copy()
    pre[..., :3] *= pre[..., 3:4]
    h, w = rgba.shape[:2]
    x = np.clip(x, 0, w - 1.001)
    y = np.clip(y, 0, h - 1.001)
    x0, y0 = np.floor(x).astype(int), np.floor(y).astype(int)
    fx, fy = (x - x0)[..., None], (y - y0)[..., None]
    out = (pre[y0, x0] * (1 - fx) * (1 - fy) + pre[y0, x0 + 1] * fx * (1 - fy)
           + pre[y0 + 1, x0] * (1 - fx) * fy + pre[y0 + 1, x0 + 1] * fx * fy)
    alpha = out[..., 3:4]
    out[..., :3] = np.where(alpha > 1e-4, out[..., :3] / np.maximum(alpha, 1e-4), 0)
    return out


def head_weight(y: np.ndarray) -> np.ndarray:
    """1 on the head, 0 on the body, smooth across the chin (same curve as the old mesh warp)."""
    t = np.clip((y - (PIVOT[1] - BEND_ABOVE)) / (BEND_ABOVE + BEND_BELOW), 0, 1)
    return 1 - t * t * (3 - 2 * t)


def turn_head(rgba: np.ndarray, dx: int, dy: int) -> np.ndarray:
    yy, xx = np.mgrid[0:CANVAS, 0:CANVAS].astype(np.float32)
    theta = np.radians(TURN_DEG * dx)
    shift = (SHIFT[0] * dx, SHIFT[1] * dy)

    def forward(px: np.ndarray, py: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        w = head_weight(py)
        a = theta * w
        ox, oy = px - PIVOT[0], py - PIVOT[1]
        return (PIVOT[0] + ox * np.cos(a) - oy * np.sin(a) + shift[0] * w,
                PIVOT[1] + ox * np.sin(a) + oy * np.cos(a) + shift[1] * w)

    # Invert the forward warp by fixed-point iteration: find the source point
    # that lands on each output pixel.
    sx, sy = xx.copy(), yy.copy()
    for _ in range(8):
        fx, fy = forward(sx, sy)
        sx, sy = sx - (fx - xx), sy - (fy - yy)
    return sample(rgba, sx, sy)


def glance(rgba: np.ndarray, dx: int, dy: int) -> np.ndarray:
    """Slides each iris inside its socket, like the old eye rig."""
    out = rgba.copy()
    yy, xx = np.mgrid[0:CANVAS, 0:CANVAS].astype(np.float32)
    for eye in EYES:
        ox, oy = dx * eye['rx'] * GLANCE[0], dy * eye['ry'] * GLANCE[1]
        socket = ((xx - eye['cx']) / (eye['rx'] * SOCKET_INSET)) ** 2 + ((yy - eye['cy']) / (eye['ry'] * SOCKET_INSET)) ** 2 <= 1
        shifted = sample(rgba, xx - ox, yy - oy)
        out[socket] = shifted[socket]
    return out


def blink(rgba: np.ndarray) -> np.ndarray:
    """Closes both eyes: a skin-coloured lid over each eye, then the lash line the art's own closed eyes use."""
    image = Image.fromarray((rgba * 255).round().astype(np.uint8), 'RGBA')
    scale = 4
    lids = Image.new('RGBA', (CANVAS * scale, CANVAS * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(lids)
    for eye in EYES:
        cx, cy, rx, ry = (eye[k] * scale for k in ('cx', 'cy', 'rx', 'ry'))
        m = LID_MARGIN * scale
        draw.ellipse((cx - rx - m, cy - ry - m, cx + rx + m, cy + ry + m), fill=(*eye['skin'], 255))
        meet = cy + ry * 0.32
        lash_rx, lash_ry = rx * 1.05, ry * 0.5
        lash_cy = meet - ry * 0.25
        draw.arc((cx - lash_rx, lash_cy - lash_ry, cx + lash_rx, lash_cy + lash_ry), 15, 165, fill=(*LASH_COLOR, 255), width=LASH_WIDTH * scale)
    image.alpha_composite(lids.resize((CANVAS, CANVAS), Image.Resampling.LANCZOS))
    return np.asarray(image, dtype=np.float32) / 255


def to_image(rgba: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(rgba, 0, 1) * 255).round().astype(np.uint8), 'RGBA')


def sheet(cells: list[np.ndarray]) -> Image.Image:
    out = Image.new('RGBA', (CELL * 3, CELL * 3), (0, 0, 0, 0))
    for index, cell in enumerate(cells):
        tile = to_image(cell).resize((CELL, CELL), Image.Resampling.LANCZOS)
        out.alpha_composite(tile, ((index % 3) * CELL, (index // 3) * CELL))
    return out


def check_image(directions: Image.Image, reactions: Image.Image) -> Image.Image:
    gap = 24
    out = Image.new('RGBA', (directions.width * 2 + gap, directions.height), (32, 33, 40, 255))
    light = Image.new('RGBA', reactions.size, (244, 244, 247, 255))
    out.alpha_composite(directions, (0, 0))
    out.alpha_composite(Image.alpha_composite(light, reactions), (directions.width + gap, 0))
    return out.resize((out.width // 2, out.height // 2), Image.Resampling.LANCZOS)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    neutral = load('neutral')
    directions = sheet([turn_head(glance(neutral, dx, dy), dx, dy) for dx, dy in DIRECTIONS])
    reactions = sheet([blink(neutral) if name is None else load(name) for name in REACTIONS.values()])
    directions.save(OUT_DIR / 'directions.webp', 'WEBP', quality=90, method=6)
    reactions.save(OUT_DIR / 'reactions.webp', 'WEBP', quality=90, method=6)
    check_image(directions, reactions).convert('RGB').save(CHECK_PATH)
    print(f'sheets: {OUT_DIR.relative_to(ROOT)}/{{directions,reactions}}.webp')
    print(f'check:  {CHECK_PATH.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
