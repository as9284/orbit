import { useEffect, useState, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Mount/unmount lifecycle
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      setMounted(true);
    } else if (mounted) {
      // Exit animation then unmount
      setVisible(false);
      const timer = setTimeout(() => {
        setMounted(false);
        previousFocus.current?.focus();
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Entry animation: wait for mount to paint, then trigger visible.
  // Double-rAF guarantees we're past the browser's first paint of the
  // invisible state, so the CSS transition always plays.
  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setVisible(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [mounted]);

  // Body scroll lock
  useEffect(() => {
    if (!mounted) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mounted]);

  // Escape key
  useEffect(() => {
    if (!mounted) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mounted, onClose]);

  // Focus trap — re-queries on every Tab so dynamically-rendered
  // children (e.g. date picker calendar) are always included
  useEffect(() => {
    if (!mounted || !visible) return;
    const panel = panelRef.current;
    if (!panel) return;

    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    // Auto-focus first element
    const initial = panel.querySelectorAll<HTMLElement>(focusableSelector);
    if (initial.length > 0) initial[0].focus();

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // Re-query each time so newly added calendar buttons are included
      const focusable = panel.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", trapFocus);
    return () => window.removeEventListener("keydown", trapFocus);
  }, [mounted, visible]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-orbit-950/85 backdrop-blur-sm transition-opacity duration-200 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className={`relative w-full ${maxWidth} bg-orbit-800 border border-white/9 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/60 max-h-[92dvh] flex flex-col transition-all duration-200 ease-out ${
          visible
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-[0.96] translate-y-3"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top glow accent */}
        <div className="absolute -top-px left-1/5 right-1/5 h-px bg-linear-to-r from-transparent via-violet-400/25 to-transparent" />

        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/6 shrink-0">
          <h2
            id="modal-title"
            className="text-sm font-semibold text-white/90 tracking-tight"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.07] transition-all duration-150"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
