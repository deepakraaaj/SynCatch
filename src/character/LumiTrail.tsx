import { useEffect, useRef } from 'react';

/** print: a glowing footprint where a foot lands; ember: a soft drifting light mote. */
type Kind = 'print' | 'ember';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  born: number;
  life: number;
  phase: number;
  color: string;
}

// Lumi's own palette — gem gold, ear mint, warm white — never the theme
// accent (on some themes that is coral/red and reads as blood, not magic).
const GOLD = '255 204 92';
const WARM_WHITE = '255 246 218';
const MINT = '140 238 208';

/** One step per half walk cycle (matches WALK_CYCLE_SECONDS in LumiMesh). */
const STEP_MS = 280;
const EMBER_EVERY_MS = 60;
const MAX_PARTICLES = 90;

interface LumiTrailProps {
  /** True while Lumi walks or is carried. */
  active: boolean;
  /** Viewport point between Lumi's feet, or null when unknown. */
  emitPoint: () => { x: number; y: number } | null;
  /** Lumi's rendered size; the trail scales with it. */
  sizePx: number;
}

/**
 * The luminous trail Lumi leaves while it moves: soft glowing footprints
 * where its feet land, and warm light motes drifting up behind it, all
 * dissolving over ~2s. Every particle is a soft round glow — no pointed
 * "sparkle" shapes, which read as cheap clip-art rather than ambient light.
 * One full-viewport canvas behind the companion; the animation loop only
 * runs while there is something to draw.
 */
export function LumiTrail({ active, emitPoint, sizePx }: LumiTrailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const props = useRef({ active, emitPoint, sizePx });
  const kick = useRef<() => void>(() => {});

  // The loop reads the latest props from the ref; start it whenever Lumi starts moving.
  useEffect(() => {
    props.current = { active, emitPoint, sizePx };
    if (active) kick.current();
  }, [active, emitPoint, sizePx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const particles: Particle[] = [];
    let frame = 0;
    let running = false;
    let darkTheme = true;
    let lastEmber = 0;
    let lastStep = 0;
    let stepSide = 1;
    let lastPoint: { x: number; y: number } | null = null;
    let heading = { x: 0, y: 0 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const add = (particle: Particle) => {
      if (particles.length >= MAX_PARTICLES) particles.shift();
      particles.push(particle);
    };

    const emit = (now: number) => {
      const point = props.current.emitPoint();
      if (!point) return;
      const s = props.current.sizePx / 148;
      if (lastPoint) {
        const dx = point.x - lastPoint.x;
        const dy = point.y - lastPoint.y;
        const length = Math.hypot(dx, dy);
        if (length > 0.5) heading = { x: dx / length, y: dy / length };
      }
      lastPoint = point;

      if (now - lastStep > STEP_MS) {
        lastStep = now;
        stepSide *= -1;
        add({
          kind: 'print', x: point.x + stepSide * 11 * s, y: point.y + 2 * s, vx: 0, vy: 0,
          size: 11 * s, born: now, life: 1500, phase: 0, color: GOLD,
        });
      }

      if (now - lastEmber > EMBER_EVERY_MS) {
        lastEmber = now;
        // Motes trail behind Lumi (opposite to where it's heading) and rise.
        const behindX = point.x - heading.x * 14 * s;
        const behindY = point.y - 22 * s - heading.y * 10 * s;
        add({
          kind: 'ember',
          x: behindX + (Math.random() - 0.5) * 34 * s,
          y: behindY + (Math.random() - 0.5) * 26 * s,
          vx: (Math.random() - 0.5) * 10 * s,
          vy: -(12 + Math.random() * 20) * s,
          size: (2.6 + Math.random() * 3.6) * s,
          born: now,
          life: 1500 + Math.random() * 900,
          phase: Math.random() * Math.PI * 2,
          color: Math.random() < 0.6 ? GOLD : MINT,
        });
      }
    };

    const glow = (x: number, y: number, radius: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, `rgb(${color} / ${alpha})`);
      g.addColorStop(0.4, `rgb(${color} / ${alpha * 0.45})`);
      g.addColorStop(1, `rgb(${color} / 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (props.current.active) emit(now);
      else lastPoint = null;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.globalCompositeOperation = darkTheme ? 'lighter' : 'source-over';
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        const age = (now - p.born) / p.life;
        if (age >= 1) {
          particles.splice(i, 1);
          continue;
        }
        // Gentle float with a sideways sway; rising slows over time.
        p.x += (p.vx + Math.sin(p.phase + now / 420) * 6 * (props.current.sizePx / 148)) * dt;
        p.y += p.vy * dt;
        p.vy *= 0.99;
        // Quick bloom in, long lingering fade out.
        const bloom = Math.min(1, age * 7);
        const fade = Math.pow(1 - age, 1.4);

        if (p.kind === 'print') {
          const alpha = bloom * fade;
          const r = p.size * (1 + age * 0.6);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(1, 0.38);
          glow(0, 0, r * 2, p.color, alpha * (darkTheme ? 0.55 : 0.7));
          glow(0, 0, r * 0.9, WARM_WHITE, alpha * (darkTheme ? 0.6 : 0.5));
          ctx.restore();
          continue;
        }

        // Embers only ever pulse gently — no spin, no pointed shape.
        const pulse = 0.75 + 0.25 * Math.sin(p.phase + now / 260);
        const alpha = bloom * fade * pulse;
        const r = p.size * (1 - age * 0.3);
        glow(p.x, p.y, r * 3.6, p.color, alpha * (darkTheme ? 0.6 : 0.65));
        glow(p.x, p.y, r * 0.9, WARM_WHITE, Math.min(1, alpha * 1.1));
      }

      if (particles.length > 0 || props.current.active) frame = window.requestAnimationFrame(tick);
      else {
        running = false;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    kick.current = () => {
      if (running) return;
      running = true;
      darkTheme = getComputedStyle(document.documentElement).colorScheme !== 'light';
      last = performance.now();
      frame = window.requestAnimationFrame(tick);
    };
    if (props.current.active) kick.current();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      kick.current = () => {};
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 z-[79] h-full w-full" />;
}
