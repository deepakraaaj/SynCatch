# Lumi artwork

- `source/` — original generated expression renders (512px, transparent). Input only; never imported by the app.
- `contact-sheet.png` — acceptance sheet: dark row, light row, then 48px/32px badges. Every expression must
  share the head size and sit on the red baseline.
- `../../scripts/normalize-lumi-assets.py` — regenerates `src/assets/lumi/` (full + badge) and the sheet
  from `source/`. Run it after any art change: `python3 scripts/normalize-lumi-assets.py`.

## Known limits of the current art

Normalization fixes scale, baseline, stray strokes and edge slivers, and drops every detached prop
("?", "zzz", thought cloud, sparkles, loose leaves/butterflies) so each face is one clean silhouette. It
cannot fix what differs in the drawings themselves: ear shape and size vary, some tails are clipped by the
original background removal (focused, happy, sleeping, thinking — softened by a feather, not restored), and
props attached to the body stay (headphones + laptop, platform glow, calm's base leaves).

## Eye rig (done in code)

Blinking and pointer-following gaze now run on the existing art (`src/character/LumiEyes.tsx`, data in
the generated `src/character/lumi-rig.ts`) for neutral, thinking, concerned and focused (gaze only). This
covers the "alive" part of the brief below without new art. What it cannot do — and why the brief still
stands — is make the drawings themselves consistent (ears, tails, baked props) or add ear/tail motion.

## Replacement brief (needs an illustrator/animator)

Recommended: one rigged 2D character in Rive, so every expression is the same model by construction.

- **Identity (must match current Lumi):** cream body, oversized green eyes, teal→gold leaf ears, curled
  teal tail, forehead tuft, four-point glowing chest gem, blush cheeks.
- **Parts:** body, head, ears ×2, tail, gem, paws, eyelids, pupils, mouth shapes. Props (headphones,
  laptop, zzz, "?") as separate toggleable layers, never part of the body.
- **State machine inputs:** `expression` (the 10 names in `src/character/lumi-assets.ts`), `walking`
  (bool), `gazeX`/`gazeY` (-1..1), `celebrate` (trigger), `reduceMotion` (bool).
- **Built-in motion:** blink every 3–6 s, idle breath, walk cycle, celebrate hop, ear/tail secondary motion.
- **Framing:** a single artboard, feet on a fixed baseline, head centre fixed — matching the normalized
  WebPs so the swap needs no layout changes.
- **Fallback:** keep the normalized WebPs for WebGL/WASM failure and reduced-resource environments.

The app side is ready for it: every surface renders through `src/character/Lumi.tsx` with an
`expression`, so swapping the renderer is a single-component change.
