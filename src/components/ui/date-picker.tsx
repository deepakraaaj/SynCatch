import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

interface DatePickerProps {
  value: string | null;
  onChange: (date: string | null) => void;
  placeholder?: string;
}

type PopupPosition = {
  top: number;
  left: number;
  width: number;
  placement: 'top' | 'bottom';
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const PANEL_WIDTH = 320;
const PANEL_GAP = 8;
const VIEWPORT_PADDING = 16;

function parseDateValue(value: string | null) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isSameCalendarDate(left: Date | null, right: Date) {
  return Boolean(
    left &&
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate(),
  );
}

export function DatePicker({ value, onChange, placeholder = 'Pick a date' }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(() => parseDateValue(value) ?? new Date());
  const [popupPosition, setPopupPosition] = useState<PopupPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const selectedDate = parseDateValue(value);
  const displayText = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : placeholder;

  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + index);
    return day;
  });

  const closeCalendar = useCallback(() => {
    setOpen(false);
    setPopupPosition(null);
  }, []);

  const openCalendar = useCallback(() => {
    setCurrentDate(parseDateValue(value) ?? new Date());
    setOpen(true);
  }, [value]);

  const updatePopupPosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const popupHeight = popupRef.current?.offsetHeight ?? 338;
    const popupWidth = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
    const shouldOpenAbove =
      rect.bottom + PANEL_GAP + popupHeight > window.innerHeight - VIEWPORT_PADDING &&
      rect.top - PANEL_GAP - popupHeight >= VIEWPORT_PADDING;

    const top = shouldOpenAbove
      ? Math.max(VIEWPORT_PADDING, rect.top - popupHeight - PANEL_GAP)
      : Math.min(rect.bottom + PANEL_GAP, window.innerHeight - popupHeight - VIEWPORT_PADDING);
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rect.right - popupWidth),
      window.innerWidth - popupWidth - VIEWPORT_PADDING,
    );

    setPopupPosition({
      top,
      left,
      width: popupWidth,
      placement: shouldOpenAbove ? 'top' : 'bottom',
    });
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => updatePopupPosition();
    const rafId = window.requestAnimationFrame(updatePosition);

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePopupPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (containerRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }

      closeCalendar();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeCalendar();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeCalendar, open]);

  function handleSelectDate(date: Date) {
    onChange(formatDateValue(date));
    closeCalendar();
  }

  function handleToday() {
    handleSelectDate(new Date());
  }

  function handleTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    handleSelectDate(tomorrow);
  }

  function handleNextWeek() {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    handleSelectDate(nextWeek);
  }

  function isToday(date: Date) {
    return isSameCalendarDate(new Date(), date);
  }

  function isCurrentMonth(date: Date) {
    return date.getMonth() === currentDate.getMonth();
  }

  const popup = open
    ? createPortal(
        <div
          ref={popupRef}
          className={cn(
            'fixed z-[120] rounded-[18px] border border-borderSoft/40 bg-panel p-4 shadow-2xl',
            popupPosition ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            top: popupPosition?.top ?? VIEWPORT_PADDING,
            left: popupPosition?.left ?? VIEWPORT_PADDING,
            width: popupPosition?.width ?? PANEL_WIDTH,
          }}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() =>
                setCurrentDate(
                  (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-panel/40 hover:text-text-primary"
            >
              ←
            </button>
            <h3 className="text-sm font-semibold text-text-primary">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <button
              type="button"
              onClick={() =>
                setCurrentDate(
                  (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
                )
              }
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-panel/40 hover:text-text-primary"
            >
              →
            </button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((day) => (
              <div key={day} className="text-center text-[10px] font-semibold text-text-muted">
                {day}
              </div>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-7 gap-1">
            {days.map((date) => (
              <button
                key={formatDateValue(date)}
                type="button"
                onClick={() => handleSelectDate(date)}
                className={cn(
                  'flex h-9 items-center justify-center rounded-[10px] border border-transparent text-xs font-medium transition-colors',
                  isSameCalendarDate(selectedDate, date)
                    ? 'border-accent/40 bg-accent/18 text-accent'
                    : isToday(date)
                      ? 'border-success/35 bg-success/10 text-text-primary'
                      : isCurrentMonth(date)
                        ? 'text-text-primary hover:border-borderSoft/30 hover:bg-panel/40'
                        : 'text-text-muted/50 hover:bg-panel/24',
                )}
              >
                {date.getDate()}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-borderSoft/20 pt-3">
            <button
              type="button"
              onClick={handleToday}
              className="rounded-full border border-borderSoft/40 px-3 py-1.5 text-[10px] font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleTomorrow}
              className="rounded-full border border-borderSoft/40 px-3 py-1.5 text-[10px] font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              Tomorrow
            </button>
            <button
              type="button"
              onClick={handleNextWeek}
              className="rounded-full border border-borderSoft/40 px-3 py-1.5 text-[10px] font-medium text-text-muted transition-colors hover:border-accent/40 hover:text-accent"
            >
              Next week
            </button>
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  closeCalendar();
                }}
                className="rounded-full border border-warning/40 px-3 py-1.5 text-[10px] font-medium text-warning transition-colors hover:bg-warning/8"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => {
            if (open) {
              closeCalendar();
              return;
            }

            openCalendar();
          }}
          className={cn(
            'w-full rounded-[10px] border bg-panel/40 px-3 py-1.5 text-left text-sm text-text-primary outline-none transition-colors',
            open ? 'border-accent/40' : 'border-borderSoft/40 hover:border-borderStrong/40',
          )}
        >
          {displayText}
        </button>
      </div>

      {popup}
    </>
  );
}
