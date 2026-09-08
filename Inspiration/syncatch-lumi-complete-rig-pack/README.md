# SynCatch Lumi Complete Rig Pack

Use this as a 2D rig source pack for React/Motion now and Rive/Spine later.

## Layer order
shadow → tail → body → feet → arms → head → ears → eyes → eyebrows → mouth
→ facial extras → chest gem → chest glow → sparkles/effects

## Included
Character parts, eye states, mouth states, facial extras, ear movements, tail movements,
hands, body poses, pre-composed expressions/actions, effects, butterfly lifecycle,
butterfly wing states, environment props, manifest pivots, and animation recipes.

## Animation principle
Do not animate the entire mascot for every emotion. Compose the emotion from layers:
eyes + mouth + ears + tail + body + effects.

Example:
LAUGH = closed eyes + laugh mouth + slight head sway + ear wiggle + tail wag.
SAD = sad eyes + sad mouth + ears down + slower breathing + optional tear.
BLINK = open → half-open → closed → half-open → open.

The `rig-manifest.json` pivots are starting points. Calibrate final offsets once in a
canonical 512×512 Lumi stage in the app.

Note: this pack is derived from the approved generated reference sheet. For final brand
production, vectorize/redraw the chosen master character parts for pixel-perfect rig alignment.
