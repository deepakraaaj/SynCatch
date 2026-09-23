import { AnimatePresence, animate, motion, useAnimationControls, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { EyeOff, MessageCircle, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { messagePop } from '../lib/motion';
import { useFocusStore } from '../features/focus/focus-store';
import { useSettingsStore } from '../features/settings/settings-store';
import { useIsMobile } from '../hooks/use-mobile';
import { VIEW_LINES } from './characterMessages';
import { announceLumi, useCompanionStore, type CompanionMode } from './companion-store';
import { Lumi } from './Lumi';
import { LumiTrail } from './LumiTrail';
import { preloadLumiAssets } from './lumi-assets';
import { useLumiExpression } from './useLumiExpression';
import { useLumiGaze } from './useLumiGaze';
import { subscribeLumiClickPulses } from './lumi-click-reactions';

/**
 * Rendered size of the companion (smaller on phones, where 148px would cover
 * a big slice of the screen); every bound below is derived from it. The dock
 * sits at right-[72px] so it clears the quick-actions FAB (right-5, 44px).
 */
const AVATAR_PX = { desktop: 148, mobile: 112 };
/** Minimum gap between Lumi and the viewport edge. */
const EDGE_PX = 12;
/** Headroom kept above Lumi so its speech bubble never leaves the viewport. */
const BUBBLE_ROOM_PX = 84;
/** Height the settings menu needs above Lumi before it flips below instead. */
const MENU_ROOM_PX = 220;
/** Walking pace (px/s) — slow enough that the steps match the ground covered. */
const WALK_SPEED_PX = 95;
/** Longest single stroll while wandering, so Lumi potters about instead of crossing the screen. */
const STROLL_MAX_PX = 340;

const MOVEMENT_OPTIONS: { mode: CompanionMode; label: string }[] = [
  { mode: 'stay', label: 'Stay' },
  { mode: 'follow', label: 'Follow' },
  { mode: 'roam', label: 'Wander' },
];

interface Bounds { minX: number; minY: number; }

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

interface LumiCompanionProps { activeView: string; blocked?: boolean; }

export function LumiCompanion({ activeView, blocked = false }: LumiCompanionProps) {
  const visible = useCompanionStore((state) => state.visible);
  const mode = useCompanionStore((state) => state.mode);
  const dialogue = useCompanionStore((state) => state.dialogue);
  const position = useCompanionStore((state) => state.position);
  const line = useCompanionStore((state) => state.line);
  const nonce = useCompanionStore((state) => state.reactionNonce);
  const hydrated = useCompanionStore((state) => state.hydrated);
  const { hydrate, toggleVisible, setMode, setDialogue, setPosition, setOnStage, react } = useCompanionStore.getState();
  const reduceMotion = useSettingsStore((state) => state.reduceMotion);
  const focusRunning = useFocusStore((state) => Boolean(state.focusSessionStart) || state.status === 'locked-in');
  const expression = useLumiExpression();
  const avatarPx = useIsMobile() ? AVATAR_PX.mobile : AVATAR_PX.desktop;
  const reaction = useCompanionStore((state) => state.reaction);

  const dockRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const boundsRef = useRef<Bounds>({ minX: 0, minY: 0 });
  const reduceMotionRef = useRef(reduceMotion);
  const draggedRef = useRef(false);
  const greetedViews = useRef(new Set<string>());
  const [bounds, setBounds] = useState<Bounds>(boundsRef.current);
  const [moving, setMoving] = useState(false);
  const [walkDirection, setWalkDirection] = useState(0);
  const walkToken = useRef(0);
  const [onLeft, setOnLeft] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuBelow, setMenuBelow] = useState(false);
  const companionRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const pop = useAnimationControls();

  // Lumi stays put during focus and when motion is reduced, whatever the chosen mode.
  const effectiveMode: CompanionMode = focusRunning || reduceMotion ? 'stay' : mode;
  const onStage = visible && !blocked;
  reduceMotionRef.current = reduceMotion;
  const gaze = useLumiGaze(avatarRef, onStage && !reduceMotion);

  useEffect(() => {
    void hydrate();
    preloadLumiAssets();
  }, [hydrate]);

  useEffect(() => {
    setOnStage(onStage);
    return () => setOnStage(false);
  }, [onStage, setOnStage]);

  const measure = useCallback(() => {
    const dock = dockRef.current?.getBoundingClientRect();
    if (!dock) return;
    const next = { minX: Math.min(0, EDGE_PX - dock.left), minY: Math.min(0, EDGE_PX + BUBBLE_ROOM_PX - dock.top) };
    boundsRef.current = next;
    setBounds(next);
  }, []);

  // Lumi walks everywhere it goes: constant pace, walk cycle on, facing the
  // way it's heading. Resolves when it arrives (or immediately if instant).
  const moveTo = useCallback((targetX: number, targetY: number, instant = false): Promise<void> => {
    const { minX, minY } = boundsRef.current;
    const nextX = clamp(targetX, minX, 0);
    const nextY = clamp(targetY, minY, 0);
    const dx = nextX - x.get();
    const distance = Math.hypot(dx, nextY - y.get());
    if (instant || reduceMotionRef.current || distance < 2) {
      x.set(nextX);
      y.set(nextY);
      return Promise.resolve();
    }
    const token = ++walkToken.current;
    const duration = Math.max(0.35, distance / WALK_SPEED_PX);
    setWalkDirection(Math.abs(dx) < 4 ? 0 : Math.sign(dx));
    setMoving(true);
    return Promise.all([
      animate(x, nextX, { duration, ease: 'linear' }),
      animate(y, nextY, { duration, ease: 'linear' }),
    ]).then(() => {
      if (walkToken.current !== token) return;
      setMoving(false);
      setWalkDirection(0);
    });
  }, [x, y]);

  const stopWalking = useCallback(() => {
    walkToken.current += 1;
    x.stop();
    y.stop();
    setMoving(false);
    setWalkDirection(0);
  }, [x, y]);

  // Re-measure and pull Lumi back inside the viewport whenever it resizes.
  useEffect(() => {
    if (!onStage) return;
    const onResize = () => {
      measure();
      void moveTo(x.get(), y.get(), true);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // avatarPx: re-measure after the size switches between phone and desktop.
  }, [avatarPx, measure, moveTo, onStage, x, y]);

  useEffect(() => {
    if (!onStage || effectiveMode !== 'stay') return;
    void moveTo(position?.x ?? 0, position?.y ?? 0);
  }, [effectiveMode, moveTo, onStage, position]);

  useEffect(() => {
    if (!onStage || effectiveMode !== 'roam') return;
    let cancelled = false;
    let timer: number;
    const stroll = () => {
      const angle = Math.random() * Math.PI * 2;
      const reach = STROLL_MAX_PX * (0.4 + Math.random() * 0.6);
      void moveTo(x.get() + Math.cos(angle) * reach, y.get() + Math.sin(angle) * reach * 0.6).then(() => {
        if (!cancelled) timer = window.setTimeout(stroll, 3500 + Math.random() * 5000);
      });
    };
    timer = window.setTimeout(stroll, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopWalking();
    };
  }, [effectiveMode, moveTo, onStage, stopWalking, x, y]);

  useEffect(() => {
    if (!onStage || effectiveMode !== 'follow') return;
    let frame = 0;
    let latest: PointerEvent | null = null;
    // Only re-target once the pointer has actually travelled — re-targeting on
    // every pixel of movement makes Lumi chase the cursor constantly instead
    // of settling near it, which reads as jittery rather than alive.
    let lastTargetX: number | null = null;
    let lastTargetY: number | null = null;
    const RETARGET_PX = 90;
    const onMove = (event: PointerEvent) => {
      latest = event;
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const dock = dockRef.current?.getBoundingClientRect();
        if (!latest || !dock) return;
        if (
          lastTargetX !== null &&
          lastTargetY !== null &&
          Math.hypot(latest.clientX - lastTargetX, latest.clientY - lastTargetY) < RETARGET_PX
        ) {
          return;
        }
        lastTargetX = latest.clientX;
        lastTargetY = latest.clientY;
        // Sit just below-right of the pointer so Lumi never covers what the user is reaching for.
        void moveTo(latest.clientX + 36 - dock.left, latest.clientY + 28 - dock.top);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.cancelAnimationFrame(frame);
      stopWalking();
    };
  }, [effectiveMode, moveTo, onStage, stopWalking]);

  // Flip the bubble and tools to Lumi's open side once it crosses the middle.
  useMotionValueEvent(x, 'change', (value) => {
    const dock = dockRef.current?.getBoundingClientRect();
    if (dock) setOnLeft(dock.left + value + dock.width / 2 < window.innerWidth / 2);
  });

  // Lumi smiles whenever you click something anywhere in the app. Each click
  // restarts the smile, so rapid clicking holds it instead of flickering;
  // real moments (celebrations, spoken lines) outrank it and play instead.
  // Subscribed even while the companion is hidden: the dashboard hero Lumi
  // shares the same reaction state.
  useEffect(() => subscribeLumiClickPulses(() => react('smile', null)), [react]);

  // Celebrations are the one moment Lumi's whole body moves: a happy hop.
  // Everything else is the head's job (see useLumiGaze) — pulsing the whole
  // picture reads as a sticker, not a companion.
  useEffect(() => {
    if (nonce === 0 || reduceMotion) return;
    if (useCompanionStore.getState().reaction !== 'celebrate') return;
    void pop.start({ y: [0, -22, 0, -9, 0], transition: { duration: 0.9, ease: 'easeOut' } });
  }, [nonce, pop, reduceMotion]);


  useEffect(() => {
    const text = VIEW_LINES[activeView];
    if (!onStage || !hydrated || focusRunning || !text || greetedViews.current.has(activeView)) return;
    greetedViews.current.add(activeView);
    // Greets with a smile — the click that opened the view already smiled.
    const timer = window.setTimeout(() => announceLumi('smile', { text }), 700);
    return () => window.clearTimeout(timer);
  }, [activeView, focusRunning, hydrated, onStage]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!companionRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const chooseMode = (next: CompanionMode) => {
    setMode(next);
    if (next === 'stay') setPosition({ x: Math.round(x.get()), y: Math.round(y.get()) });
  };

  // Viewport point between Lumi's feet (normalized art: feet gap at x 254.5, soles at y 466 of 512).
  const feetPoint = useCallback(() => {
    const dock = dockRef.current?.getBoundingClientRect();
    if (!dock) return null;
    return { x: dock.left + x.get() + dock.width * (254.5 / 512), y: dock.top + y.get() + dock.height * (466 / 512) };
  }, [x, y]);

  if (blocked) return null;

  return (
    <>
    <LumiTrail active={onStage && moving && !reduceMotion} emitPoint={feetPoint} sizePx={avatarPx} />
    <div ref={dockRef} className="pointer-events-none fixed bottom-[calc(var(--mobile-nav-height)+0.65rem)] right-[72px] z-[80] lg:bottom-5" style={{ width: avatarPx, height: avatarPx }}>
      <AnimatePresence>
        {!visible ? (
          <motion.button key="summon" type="button" data-lumi-companion onClick={toggleVisible} className="pointer-events-auto absolute bottom-0 right-0 flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-accent/25 bg-panel/95 px-4 text-xs font-bold text-accent shadow-[0_12px_35px_rgb(var(--shadow-color)/0.3)] backdrop-blur-xl" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.7 }} aria-label="Call Lumi"><Sparkles className="h-4 w-4" />Call Lumi</motion.button>
        ) : (
          <motion.div
            key="companion"
            ref={companionRef}
            data-lumi-companion
            className="absolute inset-0"
            style={{ x, y }}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
            drag={effectiveMode !== 'follow'}
            dragMomentum={false}
            dragElastic={0.06}
            dragConstraints={{ left: bounds.minX, right: 0, top: bounds.minY, bottom: 0 }}
            onDragStart={() => { draggedRef.current = true; walkToken.current += 1; setMoving(true); }}
            onDrag={(_, info) => {
              // Carried around, Lumi paddles its feet toward where it's being taken.
              const heading = Math.abs(info.velocity.x) < 40 ? 0 : Math.sign(info.velocity.x);
              setWalkDirection((current) => (current === heading ? current : heading));
            }}
            onDragEnd={() => {
              setMoving(false);
              setWalkDirection(0);
              setMode('stay');
              setPosition({ x: Math.round(x.get()), y: Math.round(y.get()) });
            }}
          >
            <AnimatePresence>
              {dialogue && line && !menuOpen ? (
                <motion.div
                  key={`${nonce}-${line.text}`}
                  role="status"
                  aria-live="polite"
                  className={cn('pointer-events-auto absolute bottom-[calc(100%-10px)] w-[232px] rounded-[20px] border border-borderSoft/35 bg-panel/95 px-4 py-3 text-[12.5px] leading-5 shadow-[0_15px_45px_rgb(var(--shadow-color)/0.28)] backdrop-blur-xl', onLeft ? 'left-4' : 'right-4')}
                  {...messagePop(reduceMotion)}
                  exit={{ opacity: 0, y: 4 }}
                >
                  <p className="font-semibold text-text-primary">{line.text}</p>
                  {line.detail ? <p className="mt-0.5 truncate text-[11.5px] text-text-secondary">{line.detail}</p> : null}
                  <i className={cn('absolute -bottom-2 h-4 w-4 rotate-45 border-b border-r border-borderSoft/35 bg-panel', onLeft ? 'left-12' : 'right-12')} />
                </motion.div>
              ) : null}
            </AnimatePresence>

            <motion.button
              ref={avatarRef}
              type="button"
              aria-label={focusRunning ? 'Lumi is focusing with you' : 'Lumi, your intent companion'}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => {
                if (draggedRef.current) { draggedRef.current = false; return; }
                const top = avatarRef.current?.getBoundingClientRect().top ?? MENU_ROOM_PX;
                setMenuBelow(top < MENU_ROOM_PX);
                if (!menuOpen) react('notice', null, 1);
                setMenuOpen((open) => !open);
              }}
              className="pointer-events-auto absolute inset-0 cursor-grab rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-accent/25 active:cursor-grabbing"
              animate={pop}
            >
              <Lumi
                // Lumi walks in its standing pose (the smile face is seated, so it
                // can't walk); other reactions, e.g. a celebration, still win.
                expression={moving && (reaction === 'idle' || reaction === 'smile') ? 'neutral' : expression}
                size="fill"
                motion={moving ? 'walk' : 'idle'}
                walkDirection={walkDirection}
                reduceMotion={reduceMotion}
                gaze={gaze}
                headGaze={gaze.head}
                label=""
                className="drop-shadow-[0_16px_14px_rgb(var(--shadow-color)/0.3)]"
              />
            </motion.button>

            <AnimatePresence>{menuOpen ? (
              <motion.div
                role="dialog"
                aria-label="Lumi settings"
                className={cn(
                  'pointer-events-auto absolute w-[232px] rounded-2xl border border-borderSoft/40 bg-panel p-1.5 text-[13px] shadow-[0_18px_48px_rgb(var(--shadow-color)/0.35)]',
                  menuBelow ? 'top-[calc(100%-2px)]' : 'bottom-[calc(100%-12px)]',
                  onLeft ? 'left-3' : 'right-3',
                )}
                initial={{ opacity: 0, y: menuBelow ? -6 : 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: menuBelow ? -4 : 4, scale: 0.98 }}
                transition={{ duration: reduceMotion ? 0 : 0.16, ease: 'easeOut' }}
              >
                <div className="px-2.5 pb-2 pt-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted">Movement</p>
                  <div role="radiogroup" aria-label="Lumi movement" className="mt-2 grid grid-cols-3 gap-0.5 rounded-xl bg-panel2 p-0.5">
                    {MOVEMENT_OPTIONS.map((option) => (
                      <button
                        key={option.mode}
                        type="button"
                        role="radio"
                        aria-checked={mode === option.mode}
                        onClick={() => chooseMode(option.mode)}
                        className={cn(
                          'h-8 rounded-[10px] text-[12px] font-medium transition-colors',
                          mode === option.mode ? 'bg-panel text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-text-muted">Drag Lumi anywhere to park it.</p>
                </div>
                <div className="my-1 h-px bg-borderSoft/40" />
                <button
                  type="button"
                  role="switch"
                  aria-checked={dialogue}
                  onClick={() => setDialogue(!dialogue)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-text-primary hover:bg-panel2"
                >
                  <MessageCircle className="h-4 w-4 text-text-secondary" />
                  <span className="flex-1">Messages</span>
                  <span aria-hidden className={cn('relative h-[18px] w-8 rounded-full transition-colors', dialogue ? 'bg-accent' : 'bg-borderSoft/70')}>
                    <span className={cn('absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-[left]', dialogue ? 'left-[15px]' : 'left-0.5')} />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); toggleVisible(); }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-text-primary hover:bg-panel2"
                >
                  <EyeOff className="h-4 w-4 text-text-secondary" />
                  <span className="flex-1">Hide Lumi</span>
                </button>
              </motion.div>
            ) : null}</AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </>
  );
}
