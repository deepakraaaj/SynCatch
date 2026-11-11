#!/usr/bin/env python3
"""Normalize Lumi's expression artwork so every expression reads as one character.

The source WebPs (design/lumi/source/) were generated separately: the head size
varies ~20% between expressions, stray semi-transparent strokes sit above the
character, and background removal left hard vertical cuts plus thin fragments
along the shared source crop box (x 106..405). This script:

  1. keeps only Lumi's body — detached props ("?", "zzz", thought cloud,
     sparkles, loose leaves/butterflies) and stray strokes are dropped so
     every expression is one clean silhouette; the face carries the emotion,
  2. feathers the hard crop-box cuts so clipped tails fade instead of ending
     in a straight line,
  3. scales every expression to the same head width and aligns the head's
     centre and the feet/seat baseline on a shared 512px canvas,
  4. writes a contact sheet used as the visual acceptance check.

Outputs: src/assets/lumi/*.webp, design/lumi/contact-sheet.png. Requires
numpy, scipy and Pillow. Then run scripts/build-lumi-mascot.py to rebuild the
page-mascot sheets the app shows.

Usage: python3 scripts/normalize-lumi-assets.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / 'design' / 'lumi' / 'source'
OUT_DIR = ROOT / 'src' / 'assets' / 'lumi'
SHEET_PATH = ROOT / 'design' / 'lumi' / 'contact-sheet.png'

CANVAS = 512
TARGET_HEAD_WIDTH = 156  # median head width across the source set
BASELINE_Y = 466
CROP_BOX_X = (106, 405)  # shared horizontal crop box of the source renders
FEATHER_PX = 14

# The head detector measures the widest cream row in the top half of the body.
# That is wrong for a character lying down (sleeping keeps its source scale and
# framing, with a hand-placed face centre in source pixels) and over-reads when
# a raised paw touches the cheek (excited, celebrating).
OVERRIDES: dict[str, dict[str, float]] = {
    'sleeping': {'scale': 1.0, 'face_x': 222, 'face_y': 372},
    'excited': {'scale': 1.02},
    'celebrating': {'scale': 1.02},
}


def clean_alpha(rgba: np.ndarray) -> np.ndarray:
    alpha = rgba[..., 3].astype(np.float32)
    labels, _ = ndi.label(alpha > 24, structure=np.ones((3, 3)))
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    # Keep the body plus the soft antialiased fringe that hugs it; everything
    # detached is a baked-in prop or a background-removal leftover.
    body = ndi.binary_dilation(labels == areas.argmax(), iterations=2)
    alpha[~body] = 0

    xs = np.arange(rgba.shape[1], dtype=np.float32)
    left = np.clip((xs - CROP_BOX_X[0]) / FEATHER_PX, 0, 1)
    right = np.clip((CROP_BOX_X[1] - xs) / FEATHER_PX, 0, 1)
    alpha *= np.minimum(left, right)[None, :] ** 0.8

    cleaned = rgba.copy()
    cleaned[..., 3] = alpha.round().astype(np.uint8)
    return cleaned


def measure(rgba: np.ndarray) -> tuple[float, float, float, int]:
    """Returns (head_width, head_centre_x, head_row_y, baseline_y) in source pixels."""
    alpha = rgba[..., 3].astype(int)
    labels, _ = ndi.label(alpha > 24, structure=np.ones((3, 3)))
    areas = np.bincount(labels.ravel())
    areas[0] = 0
    body = labels == areas.argmax()

    r, g, b = (rgba[..., i].astype(int) for i in range(3))
    cream = body & (alpha > 200) & (r > 215) & (g > 190) & (b > 140) & (r - b > 25) & (r - b < 110)
    cream_labels, _ = ndi.label(cream)
    cream_areas = np.bincount(cream_labels.ravel())
    cream_areas[0] = 0
    head = cream_labels == cream_areas.argmax()

    rows = np.where(head.any(axis=1))[0]
    top, bottom = rows[0], rows[-1]
    best_row, best_width, best_cols = top, 0, np.array([0])
    for y in range(top, top + int((bottom - top) * 0.5)):
        cols = np.where(head[y])[0]
        if cols.size > best_width:
            best_row, best_width, best_cols = y, cols.size, cols
    baseline = int(np.where(body.any(axis=1))[0][-1])
    return float(best_width), float((best_cols[0] + best_cols[-1]) / 2), float(best_row), baseline


def normalize(name: str, source: Image.Image) -> tuple[Image.Image, tuple[float, float, float]]:
    rgba = clean_alpha(np.array(source.convert('RGBA')))
    head_width, head_x, head_y, baseline = measure(rgba)
    override = OVERRIDES.get(name, {})
    scale = override.get('scale', float(np.clip(TARGET_HEAD_WIDTH / head_width, 0.9, 1.15)))
    face_x = override.get('face_x', head_x)
    face_y = override.get('face_y', head_y)

    cleaned = Image.fromarray(rgba, 'RGBA')
    size = round(CANVAS * scale)
    scaled = cleaned.resize((size, size), Image.Resampling.LANCZOS)
    # Centre on the head; overridden poses keep their source framing.
    anchor_x = CANVAS / 2 if 'face_x' in override else head_x
    offset_x = round(CANVAS / 2 - anchor_x * scale)
    offset_y = round(BASELINE_Y - baseline * scale)

    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(scaled, (offset_x, offset_y))
    face = (face_x * scale + offset_x, face_y * scale + offset_y, float(TARGET_HEAD_WIDTH))
    return canvas, face


def contact_sheet(rows: list[tuple[str, Image.Image]]) -> Image.Image:
    tile = 256
    sheet = Image.new('RGBA', (tile * len(rows), tile * 2 + 40), (32, 33, 40, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (name, full) in enumerate(rows):
        x = index * tile
        sheet.alpha_composite(full.resize((tile, tile), Image.Resampling.LANCZOS), (x, 0))
        light = Image.new('RGBA', (tile, tile), (244, 244, 247, 255))
        light.alpha_composite(full.resize((tile, tile), Image.Resampling.LANCZOS))
        sheet.alpha_composite(light, (x, tile))
        draw.text((x + 16, tile * 2 + 14), name, fill=(230, 230, 236, 255))
    guide_y = BASELINE_Y * tile / CANVAS
    draw.line([(0, guide_y), (sheet.width, guide_y)], fill=(220, 70, 70, 255))
    draw.line([(0, guide_y + tile), (sheet.width, guide_y + tile)], fill=(220, 70, 70, 255))
    return sheet


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    for path in sorted(SOURCE_DIR.glob('*.webp')):
        full, face = normalize(path.stem, Image.open(path))
        full.save(OUT_DIR / path.name, 'WEBP', quality=88, method=6)
        rows.append((path.stem, full))
        print(f'{path.stem:12s} face={tuple(round(v) for v in face)}')
    contact_sheet(rows).convert('RGB').save(SHEET_PATH)
    print(f'contact sheet: {SHEET_PATH.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
