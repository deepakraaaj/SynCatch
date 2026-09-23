import { useEffect, useRef } from 'react';

/**
 * print: a glowing footprint where a foot lands; dust: floating pixie dust;
 * star: Lumi's four-point gem shape, popping in and turning; heart: a rare
 * little heart for warmth.
 */
type Kind = 'print' | 'dust' | 'star' | 'heart';

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
  spin: number;
  color: string;
}

// Lumi's own palette — gem gold, ear mint, warm white, soft pink — never the
// theme accent (on some themes that is coral/red and reads as blood, not magic).
const GOLD = '255 204 92';
const WARM_WHITE = '255 246 218';
const MINT = '140 238 208';
const PINK = '255 160 196';

/** One step per half walk cycle (matches WALK_CYCLE_SECONDS in LumiMesh). */
const STEP_MS = 280;
const DUST_EVERY_MS = 45;
const MAX_PARTICLES = 160;

interface LumiTrailProps {
  /** True while Lumi walks or is carried. */
  active: boolean;
  /** Viewport point between Lumi's feet, or null when unknown. */
  emitPoint: () => { x: number; y: number } | null;
  /** Lumi's rendered size; the trail scales with it. */
  sizePx: number;
}

/**
 * The luminous trail Lumi leaves while it moves: glowing footprints where its
 * feet land, pixie dust and little gold stars floating up behind it, and the
 * odd tiny heart — all slowly dissolving. One full-viewport canvas behind the
 * companion; the animation loop only runs while there is something to draw.
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
    let lastDust = 0;
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
          size: 11 * s, born: now, life: 1500, phase: 0, spin: 0, color: GOLD,
        });
      }

      if (now - lastDust > DUST_EVERY_MS) {
        lastDust = now;
        // Dust trails behind Lumi (opposite to where it's heading) and rises.
        const behindX = point.x - heading.x * 14 * s;
        const behindY = point.y - 22 * s - heading.y * 10 * s;
        const roll = Math.random();
        const kind: Kind = roll < 0.06 ? 'heart' : roll < 0.34 ? 'star' : 'dust';
        const color = kind === 'heart' ? PINK : kind === 'star' ? GOLD : Math.random() < 0.5 ? MINT : WARM_WHITE;
        add({
          kind,
          x: behindX + (Math.random() - 0.5) * 40 * s,
          y: behindY + (Math.random() - 0.5) * 30 * s,
          vx: (Math.random() - 0.5) * 14 * s,
          vy: -(14 + Math.random() * 26) * s,
          size: (kind === 'star' ? 6 + Math.random() * 4 : kind === 'heart' ? 5 + Math.random() * 2 : 2.4 + Math.random() * 2.6) * s,
          born: now,
          life: 1600 + Math.random() * 900,
          phase: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 1.6,
          color,
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

    const star = (x: number, y: number, r: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.quadraticCurveTo(0, 0, 0, r);
      ctx.quadraticCurveTo(0, 0, -r, 0);
      ctx.quadraticCurveTo(0, 0, 0, -r);
      ctx.fill();
      ctx.restore();
    };

    const heart = (x: number, y: number, r: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.35);
      ctx.bezierCurveTo(-r * 1.1, -r * 0.35, -r * 0.45, -r * 1.05, 0, -r * 0.42);
      ctx.bezierCurveTo(r * 0.45, -r * 1.05, r * 1.1, -r * 0.35, 0, r * 0.35);
      ctx.fill();
      ctx.restore();
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (props.current.active) emit(now);
      else lastPoint = null;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        const age = (now - p.born) / p.life;
        if (age >= 1) {
          particles.splice(i, 1);
          continue;
        }
        // Gentle float with a sideways sway; rising slows over time.
        p.x += (p.vx + Math.sin(p.phase + now / 380) * 8 * (props.current.sizePx / 148)) * dt;
        p.y += p.vy * dt;
        p.vy *= 0.99;
        // Quick bloom in, long lingering fade out.
        const bloom = Math.min(1, age * 7);
        const fade = Math.pow(1 - age, 1.4);
        const twinkle = p.kind === 'print' ? 1 : 0.75 + 0.25 * Math.sin(p.phase + now / 110);
        const alpha = bloom * fade * twinkle;
        // Stars pop slightly larger than rest size, then settle.
        const pop = p.kind === 'star' ? 1 + 0.35 * Math.sin(Math.min(1, age * 5) * Math.PI) : 1;
        const r = p.size * pop * (p.kind === 'print' ? 1 + age * 0.6 : 1 - age * 0.25);

        ctx.globalCompositeOperation = darkTheme ? 'lighter' : 'source-over';
        if (p.kind === 'print') {
          // Soft oval glow where the foot landed.
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(1, 0.38);
          glow(0, 0, r * 2, p.color, alpha * (darkTheme ? 0.55 : 0.7));
          glow(0, 0, r * 0.9, WARM_WHITE, alpha * (darkTheme ? 0.6 : 0.5));
          ctx.restore();
          continue;
        }

        glow(p.x, p.y, r * (p.kind === 'dust' ? 3.4 : 2.6), p.color, alpha * (darkTheme ? 0.5 : 0.6));
        // Bright core: warm white on dark themes, the saturated colour on light ones.
        ctx.fillStyle = `rgb(${darkTheme ? WARM_WHITE : p.color} / ${Math.min(1, alpha * 1.1)})`;
        const angle = p.spin * age * Math.PI;
        if (p.kind === 'star') star(p.x, p.y, r, angle);
        else if (p.kind === 'heart') {
          ctx.fillStyle = `rgb(${PINK} / ${Math.min(1, alpha * 1.1)})`;
          heart(p.x, p.y, r, angle * 0.3);
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
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
