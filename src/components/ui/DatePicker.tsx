import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isBefore,
  startOfDay,
  isToday,
  parseISO,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CalendarDays,
  X,
} from "lucide-react";

interface DatePickerProps {
  /** "YYYY-MM-DD" or "" */
  value: string;
  onChange: (v: string) => void;
  /** Earliest selectable date as "YYYY-MM-DD" */
  min?: string;
  placeholder?: string;
  hasError?: boolean;
}

const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function DatePicker({
  value,
  onChange,
  min,
  placeholder = "Pick a date",
  hasError,
}: DatePickerProps) {
  const today = startOfDay(new Date());
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    value ? startOfMonth(parseISO(value)) : startOfMonth(today),
  );
  const [pickingYear, setPickingYear] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        !containerRef.current?.contains(e.target as Node) &&
        !calendarRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape without letting the event reach Modal's own Escape handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // Capture phase so it runs before Modal's bubble-phase listener
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [open]);

  // Fixed-position calendar doesn't move when the modal scrolls, so close it
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    window.addEventListener("scroll", handler, {
      capture: true,
      passive: true,
    });
    return () => window.removeEventListener("scroll", handler, true);
  }, [open]);

  const selected = value ? parseISO(value) : null;
  const minDate = min ? startOfDay(parseISO(min)) : null;

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startOffset = getDay(monthStart); // 0 = Sunday

  const yearBase = today.getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => yearBase - 1 + i);

  const isDisabled = (d: Date) => (minDate ? isBefore(d, minDate) : false);
  const todaySelectable = !isDisabled(today);

  const handleSelect = (d: Date) => {
    if (isDisabled(d)) return;
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
    buttonRef.current?.focus();
  };

  const clearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (!open && buttonRef.current) {
            setAnchorRect(buttonRef.current.getBoundingClientRect());
          }
          setOpen((o) => !o);
        }}
        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 border rounded-xl text-sm transition-all duration-200 ${
          hasError
            ? "bg-red-500/5 border-red-500/40"
            : open
              ? "bg-white/5 border-violet-500/30"
              : "bg-white/3 border-white/[0.07] hover:border-white/15 hover:bg-white/5"
        }`}
      >
        <CalendarDays
          size={13}
          className={`shrink-0 transition-colors duration-200 ${
            selected ? "text-violet-400" : "text-white/25"
          }`}
        />
        <span
          className={`flex-1 text-left transition-colors duration-200 ${
            selected ? "text-white/80" : "text-white/25"
          }`}
        >
          {selected ? format(selected, "MMM d, yyyy") : placeholder}
        </span>
        {selected && (
          <span
            role="button"
            aria-label="Clear date"
            onClick={clearDate}
            className="shrink-0 p-0.5 rounded text-white/20 hover:text-white/60 transition-colors"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {open &&
        anchorRect &&
        createPortal(
          <div
            ref={calendarRef}
            style={{
              position: "fixed",
              left: anchorRect.left,
              width: anchorRect.width,
              zIndex: 9999,
              ...(anchorRect.top > window.innerHeight * 0.55
                ? { bottom: window.innerHeight - anchorRect.top + 6 }
                : { top: anchorRect.bottom + 6 }),
            }}
            className={`animate-scale-in ${
              anchorRect.top > window.innerHeight * 0.55
                ? "origin-bottom"
                : "origin-top"
            }`}
          >
            <div className="bg-orbit-900 border border-white/8 rounded-2xl shadow-2xl shadow-black/60 p-4">
              {/* Month / year navigation */}
              <div className="flex items-center justify-between mb-3">
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => subMonths(m, 1))}
                  className={`p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/6 transition-all duration-150 ${
                    pickingYear ? "invisible" : ""
                  }`}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPickingYear((p) => !p)}
                  className="flex items-center gap-1 text-xs font-semibold text-white/80 hover:text-white select-none transition-colors duration-150"
                  aria-label={pickingYear ? "Back to calendar" : "Pick year"}
                >
                  {format(viewMonth, "MMMM yyyy")}
                  <ChevronDown
                    size={11}
                    className={`transition-transform duration-200 ${
                      pickingYear ? "rotate-180" : ""
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                  className={`p-1.5 rounded-lg text-white/30 hover:text-white/80 hover:bg-white/6 transition-all duration-150 ${
                    pickingYear ? "invisible" : ""
                  }`}
                  aria-label="Next month"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Year picker / calendar grid */}
              {pickingYear ? (
                <div className="grid grid-cols-3 gap-1 py-1">
                  {years.map((year) => {
                    const isCurrent = year === viewMonth.getFullYear();
                    return (
                      <button
                        key={year}
                        type="button"
                        onClick={() => {
                          setViewMonth((m) => new Date(year, m.getMonth(), 1));
                          setPickingYear(false);
                        }}
                        aria-pressed={isCurrent}
                        className={`py-2 text-xs font-medium rounded-lg transition-all duration-100 select-none ${
                          isCurrent
                            ? "bg-violet-500 text-white shadow-sm shadow-violet-500/30"
                            : "text-white/55 hover:text-white/90 hover:bg-white/6"
                        }`}
                      >
                        {year}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <>
                  {/* Day-of-week headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {DOW.map((d) => (
                      <div
                        key={d}
                        className="text-center text-[10px] font-semibold text-white/20 py-1 select-none"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {/* Day grid */}
                  <div className="grid grid-cols-7 gap-y-0.5">
                    {/* Leading empty cells for offset */}
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`offset-${i}`} aria-hidden="true" />
                    ))}

                    {days.map((day) => {
                      const sel = Boolean(selected && isSameDay(day, selected));
                      const dis = isDisabled(day);
                      const tod = isToday(day);

                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          disabled={dis}
                          onClick={() => handleSelect(day)}
                          aria-label={format(day, "MMMM d, yyyy")}
                          aria-pressed={sel}
                          aria-current={tod ? "date" : undefined}
                          className={`w-full py-1.5 text-[11px] font-medium rounded-lg transition-all duration-100 select-none ${
                            sel
                              ? "bg-violet-500 text-white font-semibold shadow-sm shadow-violet-500/30"
                              : dis
                                ? "text-white/15 cursor-default"
                                : tod
                                  ? "text-violet-300 hover:bg-white/6"
                                  : "text-white/55 hover:text-white/90 hover:bg-white/6"
                          }`}
                        >
                          {format(day, "d")}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Footer shortcuts */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
                <button
                  type="button"
                  disabled={!todaySelectable}
                  onClick={() => {
                    if (todaySelectable) {
                      setViewMonth(startOfMonth(today));
                      handleSelect(today);
                    }
                  }}
                  className="text-[11px] font-medium text-violet-400/60 hover:text-violet-300 disabled:text-white/15 disabled:cursor-default transition-colors"
                >
                  Today
                </button>
                {selected && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      setOpen(false);
                    }}
                    className="text-[11px] text-white/25 hover:text-white/55 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
