#!/usr/bin/env python3
"""Copy page-mascot's drawn characters into the app and make picker thumbnails.

page-mascot (https://github.com/nilbuild/page-mascot, MIT) ships its characters
as two sheets each in public/mascots/. This copies them to public/mascots/ here
(served as-is, so the desktop app works offline) and writes a small thumbnail
per character (the centre cell of its directions sheet) to
public/mascots/thumbs/, so the picker never downloads the full sheets.

Usage:
  git clone --depth 1 https://github.com/nilbuild/page-mascot /tmp/page-mascot
  python3 scripts/import-page-mascots.py /tmp/page-mascot
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'public' / 'mascots'
THUMB_PX = 128


def main() -> None:
    source = Path(sys.argv[1]) / 'public' / 'mascots'
    (DEST / 'thumbs').mkdir(parents=True, exist_ok=True)
    shutil.copy(source.parent.parent / 'LICENSE', DEST / 'LICENSE')
    names = sorted(path.name.removesuffix('-directions.webp') for path in source.glob('*-directions.webp'))
    for name in names:
        for sheet in ('directions', 'reactions'):
            shutil.copy(source / f'{name}-{sheet}.webp', DEST / f'{name}-{sheet}.webp')
        directions = Image.open(source / f'{name}-directions.webp')
        cell = directions.width // 3
        centre = directions.crop((cell, cell, cell * 2, cell * 2))
        centre.resize((THUMB_PX, THUMB_PX), Image.Resampling.LANCZOS).save(DEST / 'thumbs' / f'{name}.webp', 'WEBP', quality=85)
    print(f'{len(names)} characters -> {DEST.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
