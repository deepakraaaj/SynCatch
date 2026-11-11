import { cn } from '../lib/cn';
import { useCompanionStore } from './companion-store';
import { MASCOT_GROUPS, mascotLabel, mascotSheets, mascotThumb } from './mascots';

/** Grid of every companion character, grouped like page-mascot's cast. */
export function MascotPicker() {
  const character = useCompanionStore((state) => state.character);
  const setCharacter = useCompanionStore((state) => state.setCharacter);

  return (
    <div role="radiogroup" aria-label="Companion character" className="mt-3 space-y-3">
      {MASCOT_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">{group.label}</p>
          <div className="mt-1.5 grid grid-cols-[repeat(auto-fill,minmax(56px,1fr))] gap-1.5">
            {group.names.map((name) => {
              const thumb = mascotThumb(name);
              const selected = character === name;
              return (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={mascotLabel(name)}
                  title={mascotLabel(name)}
                  onClick={() => setCharacter(name)}
                  className={cn(
                    'aspect-square rounded-xl border bg-panel2/60 p-1 transition-colors',
                    selected ? 'border-accent ring-2 ring-accent/30' : 'border-borderSoft/40 hover:border-accent/50',
                  )}
                >
                  {thumb ? (
                    <img src={thumb} alt="" loading="lazy" draggable={false} className="h-full w-full object-contain" />
                  ) : (
                    // Lumi: the centre cell of its own directions sheet.
                    <span
                      aria-hidden
                      className="block h-full w-full"
                      style={{ backgroundImage: `url(${mascotSheets(name).directions})`, backgroundSize: '300% 300%', backgroundPosition: '50% 50%' }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
