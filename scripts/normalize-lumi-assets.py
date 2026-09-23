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
  4. writes a head-crop badge per expression for small (<=48px) surfaces,
  5. locates the open eyes on the resting expressions and writes the eye rig
     (src/character/lumi-rig.ts) that drives blinking and gaze at runtime,
  6. records the neck (chin line + pivot) of the resting expressions, which
     the runtime mesh warp bends around so the head turns on its own while
     the body stays planted — no cut, so nothing can tear,
  7. writes a contact sheet used as the visual acceptance check.

Outputs: src/assets/lumi/*.webp, src/assets/lumi/badge/*.webp,
src/character/lumi-rig.ts, design/lumi/contact-sheet.png. Requires numpy,
scipy and Pillow.

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
BADGE_DIR = OUT_DIR / 'badge'
SHEET_PATH = ROOT / 'design' / 'lumi' / 'contact-sheet.png'
RIG_PATH = ROOT / 'src' / 'character' / 'lumi-rig.ts'

# Expressions whose eyes are open in the art. Winks and closed-eye faces never
# blink or glance — that would contradict the drawing.
RIG_EXPRESSIONS = ('neutral', 'thinking', 'concerned', 'focused')
# Faces whose brows are drawn on top of the eyes: a lid would erase the brows,
# so they glance but never blink.
NO_BLINK = ('focused',)

# Chin line (normalized-canvas y) for the expressions whose head can turn on
# its own. Hand-set: Lumi has no visible neck and paws sit near the face, so
# automatic detection lands on shoulders or paws. The runtime bends the art
# smoothly across this line (LumiMesh.tsx) rather than cutting it. Left out:
# sleeping (lying down), focused (face on the laptop), and the arms-up
# celebrating/excited, which only show briefly as reactions.
HEAD_CUTS = {'neutral': 359, 'thinking': 352, 'happy': 362, 'calm': 356, 'encouraging': 344, 'concerned': 350}

# Walk rig for the standing pose Lumi walks in (normalized-canvas px, measured
# from the silhouette): legs bend from the hip line to the soles and split at
# splitX between the feet; arms hang outside leftX/rightX between topY/bottomY.
WALK_RIG = {
    'neutral': {'hipY': 426, 'soleY': 466, 'splitX': 254.5, 'armLeftX': 205, 'armRightX': 306, 'armTopY': 362, 'armBottomY': 420},
}

CANVAS = 512
BADGE = 256
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


def badge(full: Image.Image, face: tuple[float, float, float]) -> Image.Image:
    face_x, face_y, head_width = face
    side = head_width * 1.75
    top = face_y - side * 0.5
    box = (round(face_x - side / 2), round(top), round(face_x + side / 2), round(top + side))
    return full.crop(box).resize((BADGE, BADGE), Image.Resampling.LANCZOS)


def find_eyes(full: Image.Image, face: tuple[float, float, float]) -> list[dict]:
    """Fits an ellipse to each open eye near the face centre (512px canvas coordinates)."""
    rgba = np.array(full).astype(int)
    r, g, b, alpha = (rgba[..., i] for i in range(4))
    face_x, face_y = int(face[0]), int(face[1])
    region = np.zeros(alpha.shape, bool)
    region[max(0, face_y - 70):face_y + 110, face_x - 100:face_x + 100] = True
    # Iris: dark navy top shading into green at the bottom; highlights are holes we fill.
    iris = region & (alpha > 200) & (r < 120) & ((b - r > 8) | (g - r > 40))
    iris = ndi.binary_fill_holes(ndi.binary_closing(iris, iterations=2))
    labels, _ = ndi.label(iris)
    yy, xx = np.mgrid[0:alpha.shape[0], 0:alpha.shape[1]]
    eyes = []
    for index in range(1, labels.max() + 1):
        mask = labels == index
        ys, xs = np.where(mask)
        if xs.size < 400 or xs.max() - xs.min() > 60:  # specks, headphones
            continue
        top, bottom = ys.min(), ys.max()
        rx = max(mask[y].sum() for y in range((top + bottom) // 2, bottom + 1)) / 2
        ry = min((bottom - top + 1) / 2, rx * 1.22)  # angry brows can merge into the top
        cy = bottom - ry + 0.5
        cols = np.where(mask[int(cy)])[0]
        cx = (cols.min() + cols.max()) / 2 if cols.size else xs.mean()
        distance = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
        ring = (distance > 1.6) & (distance < 3.2) & (alpha > 220) & (r > 200) & (g > 170) & (r - b > 20)
        if ring.sum() < 50 or not 12 <= rx <= 22:
            continue
        skin = np.median(rgba[ring][:, :3], axis=0)
        if skin[0] < 245:  # not surrounded by face: ear tip or edge fragment
            continue
        eyes.append({'area': int(xs.size), 'cx': cx, 'cy': cy, 'rx': rx, 'ry': ry, 'skin': '#%02x%02x%02x' % tuple(int(v) for v in skin)})
    eyes = sorted(sorted(eyes, key=lambda eye: -eye['area'])[:2], key=lambda eye: eye['cx'])
    return [{key: (round(value, 1) if isinstance(value, float) else value) for key, value in eye.items() if key != 'area'} for eye in eyes]


def neck_pivot_x(full: Image.Image, cut: int, face: tuple[float, float, float]) -> float:
    """Centre of the silhouette at the chin line, on the run that contains the face."""
    alpha = np.array(full)[..., 3]
    labels, _ = ndi.label(alpha[cut] > 120)
    run = np.where(labels == labels[int(face[0])])[0] if labels[int(face[0])] else np.where(labels > 0)[0]
    return float((run.min() + run.max()) / 2)


def write_rig(rig: dict[str, dict]) -> None:
    lines = [
        '// Generated by scripts/normalize-lumi-assets.py — do not edit by hand.',
        "import type { LumiExpression } from './lumi-assets';",
        '',
        '/** One open eye, in the 512px normalized art canvas. `skin` is the face colour around it (for eyelids). */',
        'export interface LumiEye { cx: number; cy: number; rx: number; ry: number; skin: string; }',
        '',
        '/** Neck (512px canvas): the head turns around (pivotX, pivotY); pivotY is also the chin line the art bends across. */',
        'export interface LumiHead { pivotX: number; pivotY: number; }',
        '',
        '/** Standing-pose legs and arms (512px canvas) the walk cycle bends. */',
        'export interface LumiWalk { hipY: number; soleY: number; splitX: number; armLeftX: number; armRightX: number; armTopY: number; armBottomY: number; }',
        '',
        'export interface LumiRig { eyes: readonly LumiEye[]; blink: boolean; head?: LumiHead; walk?: LumiWalk; }',
        '',
        'export const LUMI_RIG: Partial<Record<LumiExpression, LumiRig>> = {',
    ]
    for name, entry in sorted(rig.items()):
        eyes = ', '.join(
            f"{{ cx: {e['cx']}, cy: {e['cy']}, rx: {e['rx']}, ry: {e['ry']}, skin: '{e['skin']}' }}" for e in entry['eyes']
        )
        blink = 'true' if entry['eyes'] and name not in NO_BLINK else 'false'
        head = f", head: {{ pivotX: {entry['head'][0]}, pivotY: {entry['head'][1]} }}" if 'head' in entry else ''
        walk = ''
        if name in WALK_RIG:
            walk = ', walk: { ' + ', '.join(f'{key}: {value}' for key, value in WALK_RIG[name].items()) + ' }'
        lines.append(f'  {name}: {{ blink: {blink}, eyes: [{eyes}]{head}{walk} }},')
    lines += ['};', '']
    RIG_PATH.write_text('\n'.join(lines))


def contact_sheet(rows: list[tuple[str, Image.Image, Image.Image]]) -> Image.Image:
    tile = 256
    sheet = Image.new('RGBA', (tile * len(rows), tile * 2 + 104), (32, 33, 40, 255))
    draw = ImageDraw.Draw(sheet)
    for index, (name, full, small) in enumerate(rows):
        x = index * tile
        sheet.alpha_composite(full.resize((tile, tile), Image.Resampling.LANCZOS), (x, 0))
        light = Image.new('RGBA', (tile, tile), (244, 244, 247, 255))
        light.alpha_composite(full.resize((tile, tile), Image.Resampling.LANCZOS))
        sheet.alpha_composite(light, (x, tile))
        sheet.alpha_composite(small.resize((48, 48), Image.Resampling.LANCZOS), (x + 16, tile * 2 + 12))
        sheet.alpha_composite(small.resize((32, 32), Image.Resampling.LANCZOS), (x + 76, tile * 2 + 20))
        draw.text((x + 120, tile * 2 + 28), name, fill=(230, 230, 236, 255))
    guide_y = BASELINE_Y * tile / CANVAS
    draw.line([(0, guide_y), (sheet.width, guide_y)], fill=(220, 70, 70, 255))
    draw.line([(0, guide_y + tile), (sheet.width, guide_y + tile)], fill=(220, 70, 70, 255))
    return sheet


def main() -> None:
    BADGE_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    rig: dict[str, dict] = {}
    for path in sorted(SOURCE_DIR.glob('*.webp')):
        full, face = normalize(path.stem, Image.open(path))
        small = badge(full, face)
        if path.stem in RIG_EXPRESSIONS:
            eyes = find_eyes(full, face)
            if len(eyes) == 2:
                rig.setdefault(path.stem, {'eyes': []})['eyes'] = eyes
            else:
                print(f'  ! {path.stem}: found {len(eyes)} eyes, skipping eye rig')
        if path.stem in HEAD_CUTS:
            pivot_x = neck_pivot_x(full, HEAD_CUTS[path.stem], face)
            rig.setdefault(path.stem, {'eyes': []})['head'] = (round(pivot_x, 1), HEAD_CUTS[path.stem])
        full.save(OUT_DIR / path.name, 'WEBP', quality=88, method=6)
        small.save(BADGE_DIR / path.name, 'WEBP', quality=88, method=6)
        rows.append((path.stem, full, small))
        print(f'{path.stem:12s} face={tuple(round(v) for v in face)}')
    write_rig(rig)
    print(f'rig: {RIG_PATH.relative_to(ROOT)} ({", ".join(rig)})')
    contact_sheet(rows).convert('RGB').save(SHEET_PATH)
    print(f'contact sheet: {SHEET_PATH.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
