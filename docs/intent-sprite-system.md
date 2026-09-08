# Intent Sprite System

Lumi is SynCatch's living companion — the visual face of "who I am becoming every day." This document
covers the character system as implemented in this first pass. See [§17](#17-future-improvements) for what
is intentionally deferred.

## 1. Product philosophy

```
User → Intention → Intent Sprite → Small daily actions → Consistency → Transformation → Butterfly → Becoming your intended self
```

Lumi (the Intent Sprite) is the **hero** — a companion, not a teacher. The butterfly is **not** a second
mascot; it's a rare transformation symbol reserved for meaningful consistency milestones. SynCatch never
shames the user for missing a day — copy is always recovery-oriented ("Your momentum paused," "Let's
continue from here"), never guilt-based ("You failed," "You lost everything").

## 2. Character meanings

| Symbol | Meaning |
|---|---|
| Inner Light (the sprite's glowing core) | Intention |
| Growth (expression: focused/happy/excited) | Small actions |
| Rhythm (streak) | Consistency |
| Butterfly | Transformation |
| Glow (intensity) | Positive momentum |

## 3. Character states

`CharacterMood` (`src/character/types.ts`): `dormant | settling | recovering | attentive | steady |
building | glowing | radiant`. There is deliberately no "angry" state — concern is expressed as
`attentive` (a gentle nudge for overdue tasks), never as punishment.

## 4. State transition rules

Resolved deterministically by `resolveCharacterState()` (`src/character/characterState.ts`), first match
wins:

1. `overdueBurden >= 5` and active recently → `attentive`
2. `daysInactive >= 3` → `dormant`
3. `daysInactive` 1–2 → `settling`
4. Streak just broke (`streak === 0`, `bestStreak > 0`) → `recovering`
5. `streak >= 21` → `radiant`
6. `streak >= 7` → `glowing`
7. `streak >= 3` → `building`
8. else → `steady`

No LLM, no randomness — pure function of `tasks` + `now`. Message *selection* within a mood uses a
deterministic string hash (same event/day always yields the same line; see `characterMessages.ts`).

## 5. Butterfly milestone rules

Fires at `streak === 7`, `21`, or `30` (`MILESTONE_DAYS` in `src/character/types.ts`). Each threshold
celebrates once per crossing — dedupe is tracked in `src/character/milestoneRules.ts`/
`useCharacterState.ts` and persisted (see §7). If the streak resets to 0 and climbs back through 7, it
fires again — a legitimate new milestone. The butterfly visual (`ButterflyEffect.tsx`) is exclusive to the
dashboard in this pass; completion toasts can carry milestone-aware copy without the visual.

## 6. Architecture

```
src/character/
  types.ts             — CharacterMood, CharacterStateResult, etc.
  characterState.ts     — resolveCharacterState() — pure resolver
  characterConfig.ts    — per-mood glow config (no colors, no drawing)
  characterMessages.ts  — copy tables + deterministic picker
  milestoneRules.ts     — 7/21/30-day dedupe (pure set ops)
  useCharacterState.ts  — the ONLY I/O in the system (hook)
  lumi-assets.ts          — expression → art asset map, mood → expression map
  Lumi.tsx                — renders the art asset (image only, never redrawn)
  LumiGlow.tsx            — glow halo wrapper (separate from the artwork)
  IntentSprite.tsx        — maps a behavioral mood onto Lumi + LumiGlow
  CharacterReaction.tsx  — sprite + message bubble
  ButterflyEffect.tsx    — rare milestone animation (its own SVG effect, not Lumi)
  characterToast.ts      — completion toast copy helper

src/assets/lumi/          — the actual mascot artwork (10 transparent .webp files)
src/lib/motion.ts        — shared reduceMotion-aware animation variants
src/features/dashboard/LumiHeroCard.tsx — dashboard integration
```

Everything except `useCharacterState.ts` is a pure function/component — safe to call on every render, easy
to reason about, no hidden network calls.

**Lumi is an art asset, not a CSS/SVG illustration.** `src/assets/lumi/*.webp` holds 10 pre-rendered,
transparent-background expressions (neutral, happy, excited, focused, thinking, concerned, encouraging,
celebrating, sleeping, calm). `Lumi.tsx` only selects the right file and renders it with `object-contain` —
it never draws, approximates, or redraws the character. `characterState.ts`'s behavioral moods (dormant,
settling, recovering, attentive, steady, building, glowing, radiant) map onto this fixed expression set via
`MOOD_TO_EXPRESSION` in `lumi-assets.ts`. Glow/sparkle/butterfly effects are layered around the artwork by
separate components (`LumiGlow`, `ButterflyEffect`) and never touch the image itself.

## 7. Data model

**No new backend schema.** Streak/consistency is derived entirely client-side from the existing
`tasks.completed_at` column (migration 001; its own comment already says "drives velocity and streak
stats"). The only persisted character-system state is a tiny milestone-seen dedupe blob, reusing the
*existing* generic `app_preferences(user_id, key, value)` table via the existing `selectPreference`/
`upsertPreference` functions — key `character_milestones_seen`, value `{ seen: number[] }`. Unauthenticated
users get the same dedupe via `localStorage` (`lumi-milestones-seen-v1`).

## 8. Component structure

- `Lumi` — `expression`, `size ('sm'|'md'|'lg'|'hero')`, `reduceMotion`, `label` props. Renders one
  `src/assets/lumi/*.webp` file via `<img object-contain>`; applies only per-expression Framer Motion
  transforms (float, breathing, spring, subtle sway) — never redraws the character.
- `LumiGlow` — wraps `Lumi` with a theme-adaptive, layered `box-shadow` halo. No image, no drawing — purely
  an effect layered around the art.
- `IntentSprite` — the mood-facing entry point most of the app uses: maps a `CharacterMood` to a Lumi
  expression (`MOOD_TO_EXPRESSION`) and glow intensity, and renders `LumiGlow(Lumi(...))`.
- `CharacterReaction` — wraps `IntentSprite` + an `aria-live="polite"` message bubble, for inline moments.
- `ButterflyEffect` — `level (7|21|30)`, `onComplete`; self-cleans after ~2.4s or renders a static badge
  under reduced motion. Its own small SVG effect (the transformation symbol) — deliberately not part of the
  Lumi art asset set, since the butterfly is a separate, rarer symbol.
- `LumiHeroCard` — the dashboard integration; calls `useCharacterState()` directly, no prop drilling.

## 9. Backend integration

None beyond reading `tasks` (already loaded by `task-store.ts`) and the optional `app_preferences`
dedupe write described in §7. No migrations were added.

## 10. App icon strategy

**Deferred** — see §17.

## 11. Widget strategy

Implemented as `LumiHeroCard`, a dashboard-embedded "hero" card ("a tiny world where Lumi lives"): sprite +
mood headline + supporting line + streak/best-streak. Native OS home-screen widgets are deferred (§17).

## 12. Animation strategy

`src/lib/motion.ts` centralizes reduceMotion-gated variants (`stagger`, `spriteEnter`, `butterflyDrift`,
`messagePop`), replacing the per-file duplicated `stagger()` helper that existed before this change.
`IntentSprite` also has a slow ambient "breathing" pulse driven by `characterConfig.ts`'s per-mood
`pulseSpeedMs`. All animation respects both the app's explicit `reduceMotion` setting (from
`useSettingsStore`, authoritative) and the OS `prefers-reduced-motion` media query already handled
globally.

## 13. Notification strategy

No new OS/push notification system (none existed before this pass — see repository audit). Task-completion
toasts (`src/features/toasts/toast-store.ts`, unchanged) now carry character-voiced copy instead of literal
"Task completed" text, via `characterToast.ts`.

## 14. Accessibility

- Mood is never color-only — Lumi's facial expression/pose (drawn into the artwork itself) and copy always
  accompany the glow color, so `mono-ink` (single-hue theme) and colorblind users get the full signal.
- `Lumi` renders as an `<img alt="...">`; the alt text defaults to "Lumi" and can be overridden per moment.
- `CharacterReaction`'s message bubble is `aria-live="polite"`.
- `ButterflyEffect` is `aria-hidden` (decorative); reduced motion swaps it for a static, announced badge.

## 15. Performance

`resolveCharacterState` is O(n) over the in-memory `tasks` array, memoized, recomputed only on task-store
mutation — no polling. `ButterflyEffect` mounts only on the rare milestone day. Milestone dedupe involves a
single read on mount and a write only when a milestone actually fires.

Lumi's 10 expression images (`src/assets/lumi/*.webp`, ~80-150KB each, ~1MB total) are statically imported,
but Vite resolves each `import` to a URL string at build time rather than inlining the bytes — verified
against the production build's network trace: only the one expression actually rendered (e.g.
`calm-[hash].webp`) is ever fetched by the browser, not all 10. No explicit lazy-loading was needed to
satisfy "don't load every character state on initial page load."

## 16. Testing

No test runner is configured in this repository yet, so verification for this pass was manual:
`tsc --noEmit`, `eslint`, and a full `vite build`, all clean. See the plan's verification section
(`/home/deepakrajb/.claude/plans/wise-hugging-pudding.md`) for the manual QA checklist (all 7 themes,
reduced motion, streak scenarios, mobile).

## 17. Future improvements

Explicitly out of scope for this pass, per the product spec:

- **OS app icon states** — bright/waiting/concerned/dim/recovery/celebration icon variants (Tauri desktop
  icon swapping; iOS/Android would need native work).
- **Native home-screen widgets** — would require separate native widget extensions per platform.
- **Full Intent Sprite family** — Spark/Bloom/Flow/Rise/Calm/Focus/Dream variants; only default Lumi ships
  today.
- **New notification system** — no OS-level push/notification system exists yet to give milestone-aware
  tone to.
- **Journey/stage model** — the spec's Seed → Growing → Flowing → Strong → Transforming → Butterfly stage
  structure is not yet modeled; `momentum`/`mood` cover the immediate-term signal only.
