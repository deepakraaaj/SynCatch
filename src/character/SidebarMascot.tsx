import { useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { confirmDialog } from '../components/ui/native-dialog';
import { useCompanionStore } from './companion-store';
import { Mascot } from './Mascot';
import { mascotLabel, mascotSheets } from './mascots';
import { useMascotCue } from './useMascotCue';

const SIZE = 120;
/** Show the top of the cell only, so the character peeks over the "All apps" card below it. */
const PEEK_PX = Math.round(SIZE * 0.86);
/** Movement before a press becomes a drag, so a click still boops. */
const DRAG_PX = 8;
/** Mirrors the floating companion's desktop dock in LumiCompanion (right-[72px], lg:bottom-5, 148px). */
const DOCK = { right: 72, bottom: 20, size: 148 };

/**
 * The companion's desktop home: peeking over the sidebar's "All apps" card.
 * Dragging it out asks first, then hands over to the floating companion at
 * the drop point; its menu has "Back to sidebar".
 */
export function SidebarMascot() {
  const hidden = useCompanionStore((state) => state.hidden);
  const inSidebar = useCompanionStore((state) => state.inSidebar);
  const character = useCompanionStore((state) => state.character);
  const cue = useMascotCue();
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  if (hidden || !inSidebar) return null;

  const label = mascotLabel(character);
  const sheets = mascotSheets(character);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    drag.current = { x: event.clientX, y: event.clientY, moved: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    if (!current) return;
    if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) > DRAG_PX) {
      current.moved = true;
      // Capture only once it is a drag, so a plain click still reaches the mascot.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (current.moved) setGhost({ x: event.clientX, y: event.clientY });
  };

  const onPointerUp = async (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    drag.current = null;
    setGhost(null);
    if (!current?.moved) return;
    justDragged.current = true;
    const drop = { x: event.clientX, y: event.clientY };
    const move = await confirmDialog(`${label} will float on your screen. You can bring it back from its menu.`, {
      title: `Move ${label} out of the sidebar?`,
      confirmLabel: 'Move it',
    });
    if (!move) return;
    const { setPosition, setMode, setInSidebar } = useCompanionStore.getState();
    const dockLeft = window.innerWidth - DOCK.right - DOCK.size;
    const dockTop = window.innerHeight - DOCK.bottom - DOCK.size;
    setPosition({
      x: Math.min(0, Math.round(drop.x - DOCK.size / 2 - dockLeft)),
      y: Math.min(0, Math.round(drop.y - DOCK.size / 2 - dockTop)),
    });
    setMode('stay');
    setInSidebar(false);
  };

  // The click that ends a drag must not boop.
  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (!justDragged.current) return;
    justDragged.current = false;
    event.stopPropagation();
    event.preventDefault();
  };

  return (
    <>
      <div
        data-lumi-companion
        className="-mb-4 ml-2 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
        style={{ width: SIZE, height: PEEK_PX }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(event) => void onPointerUp(event)}
        onPointerCancel={() => { drag.current = null; setGhost(null); }}
        onClickCapture={onClickCapture}
      >
        <Mascot {...sheets} cue={cue} size={SIZE} label={label} />
      </div>
      {ghost
        ? createPortal(
            <span
              aria-hidden
              className="pointer-events-none fixed z-[200] opacity-85 drop-shadow-[0_16px_14px_rgb(var(--shadow-color)/0.3)]"
              style={{
                left: ghost.x - SIZE / 2,
                top: ghost.y - SIZE / 2,
                width: SIZE,
                height: SIZE,
                backgroundImage: `url(${sheets.directions})`,
                backgroundSize: '300% 300%',
                backgroundPosition: '50% 50%',
              }}
            />,
            document.body,
          )
        : null}
    </>
  );
}
