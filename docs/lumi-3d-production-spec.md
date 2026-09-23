# Lumi 3D production specification

> **Status: parked.** Consistency is being solved in 2D first (normalized art, single renderer —
> see `docs/intent-sprite-system.md` §6 and `design/lumi/README.md`). A rigged 2D (Rive) character is the
> preferred next step; revisit 3D only if that cannot meet the identity bar.

## Quality gate

The 3D model must preserve the approved 2D Lumi identity: oversized luminous
eyes, cream fur, teal-to-gold ears and tail, small rounded paws, soft cheek
volume, forehead tuft, and glowing four-point chest gem. Primitive-only models
or models that change the facial proportions are not acceptable.

Required turntable review angles: front, front three-quarter, profile, rear
three-quarter, and rear. Each angle must read as the same character.

## Deliverable

- Format: binary glTF (`src/assets/lumi-3d/lumi.glb`)
- Embedded PBR textures; 2K maximum per texture set
- Y-up, +Z forward, origin between the feet
- Real-world scale: character height `1.0`
- Under 65k triangles for the primary mesh
- One skinned character mesh; separate transparent eye surfaces are allowed
- No baked background, lighting, floor, text, or watermark

## Required skeleton nodes

`Root`, `Body`, `Chest`, `Neck`, `Head`, `Ear.L`, `Ear.R`, `Eye.L`, `Eye.R`,
`Pupil.L`, `Pupil.R`, `Arm.L`, `Arm.R`, `Paw.L`, `Paw.R`, `Leg.L`, `Leg.R`,
`Foot.L`, `Foot.R`, `Tail.01`, `Tail.02`, `Tail.03`, `Gem`.

## Facial controls

Blinking must use eyelids or blend shapes—not scaling the complete eyeball.
Required morph targets: `Blink.L`, `Blink.R`, `Smile`, `MouthOpen`, `Concerned`,
`CheekRaise`. Pupils must remain independently aimable. Eye aim leads the head;
head aim follows with damping; the torso follows only beyond the head comfort
angle.

## Animation clips

`Idle`, `Walk`, `Wave`, `Celebrate`, `Focus`, `Sit`, `Sleep`, `Recover`, and
`Land`. All loops must be seamless. Root motion stays disabled because the app
movement controller owns screen-space travel.

## Runtime behavior

- Eye target response: 70–110ms
- Head follow damping: 160–240ms
- Torso follow damping: 280–420ms
- Maximum head yaw: 32 degrees; maximum pitch: 18 degrees
- Maximum pupil travel must remain inside the visible eye surface
- Walk speed blends with actual companion velocity
- Wave is additive on the upper body
- Tail and ears use secondary spring motion
- Reduced-motion mode freezes locomotion and retains only static poses

## App integration

One shared renderer must power the dashboard, floating companion, focus HUD,
task reactions, milestone celebrations, and preview surfaces. Tiny toast icons
may use a cached thumbnail rendered from the same GLB. The legacy WebP remains
the fallback for WebGL failure and reduced-resource environments.
