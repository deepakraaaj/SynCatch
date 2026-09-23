import { animate, motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion';
import { Fragment, useEffect, useId } from 'react';
import type { LumiEye, LumiRig } from './lumi-rig';

/** Where Lumi is looking, each axis in -1..1 (0 = straight ahead). */
export interface LumiGaze { x: MotionValue<number>; y: MotionValue<number>; }

const LASH_COLOR = '#2a1f24';
const LASH_WIDTH = 5;
/** Iris travel as a share of the eye radius — keeps the pupil inside the drawn eye. */
const GAZE_TRAVEL = { x: 0.22, y: 0.18 };
/** The socket the shifted iris shows through is inset so no skin ever slides into the eye. */
const SOCKET_INSET = 0.8;

interface LumiEyesProps {
  src: string;
  rig: LumiRig;
  gaze?: LumiGaze;
}

/**
 * The only "rig" layer on Lumi's artwork, positioned in the art's 512px
 * canvas. Gaze re-shows the art's own iris, shifted a few pixels inside the
 * eye; blinking lowers skin-coloured lids sampled from the face around each
 * eye. Nothing else about the character is redrawn.
 */
export function LumiEyes({ src, rig, gaze }: LumiEyesProps) {
  const { eyes, blink } = rig;
  const id = useId().replace(/:/g, '');
  const closed = useMotionValue(0);
  const still = useMotionValue(0);

  useEffect(() => {
    if (!blink) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        const double = Math.random() < 0.15;
        void animate(closed, double ? [0, 1, 0, 1, 0] : [0, 1, 0], { duration: double ? 0.42 : 0.17, ease: 'easeInOut' });
        schedule();
      }, 2400 + Math.random() * 3600);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [blink, closed]);

  return (
    <svg viewBox="0 0 512 512" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
      <defs>
        <filter id={`${id}-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.1" /></filter>
        <filter id={`${id}-lid-soft`} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.4" /></filter>
        {eyes.map((eye, index) => (
          <Fragment key={index}>
            <mask id={`${id}-socket-${index}`}>
              <ellipse cx={eye.cx} cy={eye.cy} rx={eye.rx * SOCKET_INSET} ry={eye.ry * SOCKET_INSET} fill="white" filter={`url(#${id}-soft)`} />
            </mask>
            <mask id={`${id}-lid-${index}`}>
              <ellipse cx={eye.cx} cy={eye.cy} rx={lidRx(eye)} ry={lidRy(eye)} fill="white" filter={`url(#${id}-lid-soft)`} />
            </mask>
          </Fragment>
        ))}
      </defs>
      {eyes.map((eye, index) => (
        <Eye key={index} id={id} index={index} eye={eye} src={src} closed={closed} gazeX={gaze?.x ?? still} gazeY={gaze?.y ?? still} />
      ))}
    </svg>
  );
}

// Lids cover the drawn eye plus its dark outline (a few px beyond the fitted
// ellipse) and nothing more, so brows and face shading stay untouched.
const LID_MARGIN_PX = 6.5;
const lidRx = (eye: LumiEye) => eye.rx + LID_MARGIN_PX;
const lidRy = (eye: LumiEye) => eye.ry + LID_MARGIN_PX;

interface EyeProps {
  id: string;
  index: number;
  eye: LumiEye;
  src: string;
  closed: MotionValue<number>;
  gazeX: MotionValue<number>;
  gazeY: MotionValue<number>;
}

function Eye({ id, index, eye, src, closed, gazeX, gazeY }: EyeProps) {
  const { cx, cy, rx, ry, skin } = eye;
  const RX = lidRx(eye);
  const RY = lidRy(eye);
  // Lids meet below centre, like the art's own closed eyes.
  const meet = cy + ry * 0.32;
  const top = cy - RY;
  const bottom = cy + RY;

  const shiftX = useTransform(gazeX, (value) => value * rx * GAZE_TRAVEL.x);
  const shiftY = useTransform(gazeY, (value) => value * ry * GAZE_TRAVEL.y);
  const upperLid = useTransform(closed, (t) => {
    const edge = top + (meet - top) * t;
    const sag = ry * 0.4 * t; // the lid's lower edge bows downward as it closes
    const shoulder = edge - sag * 0.6;
    const curve = sag > 0.01 ? `A${RX},${sag} 0 0 1 ${cx - RX},${edge}` : `L${cx - RX},${edge}`;
    return `M${cx - RX},${top - 2}H${cx + RX}V${shoulder}L${cx + RX},${edge}${curve}V${shoulder}Z`;
  });
  const lowerLid = useTransform(closed, (t) => {
    const edge = bottom - (bottom - meet) * t;
    return `M${cx - RX},${edge}H${cx + RX}V${bottom + 2}H${cx - RX}Z`;
  });
  const lidOpacity = useTransform(closed, (t) => (t > 0.01 ? 1 : 0));
  const lashOpacity = useTransform(closed, [0.8, 1], [0, 1]);

  // Closed-eye lash: the lower arc of an ellipse centred just above the lid seam.
  const lashRx = rx * 1.05;
  const lashRy = ry * 0.5;
  const lashCy = meet - ry * 0.25;
  const angle = (degrees: number) => (degrees * Math.PI) / 180;
  const lashFrom = `${cx + lashRx * Math.cos(angle(15))},${lashCy + lashRy * Math.sin(angle(15))}`;
  const lashTo = `${cx + lashRx * Math.cos(angle(165))},${lashCy + lashRy * Math.sin(angle(165))}`;

  return (
    <>
      <g mask={`url(#${id}-socket-${index})`}>
        <motion.image href={src} width={512} height={512} style={{ x: shiftX, y: shiftY }} />
      </g>
      <motion.g mask={`url(#${id}-lid-${index})`} style={{ opacity: lidOpacity }}>
        <motion.path d={upperLid} fill={skin} />
        <motion.path d={lowerLid} fill={skin} />
      </motion.g>
      <motion.path
        d={`M${lashFrom}A${lashRx},${lashRy} 0 0 1 ${lashTo}`}
        fill="none"
        stroke={LASH_COLOR}
        strokeWidth={LASH_WIDTH}
        strokeLinecap="round"
        style={{ opacity: lashOpacity }}
      />
    </>
  );
}
