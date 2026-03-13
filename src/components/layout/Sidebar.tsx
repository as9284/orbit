import { NavLink } from "react-router-dom";
import {
  ListTodo,
  Archive,
  Settings,
  StickyNote,
  BrainCircuit,
  MessagesSquare,
  PenLine,
  Menu,
  X,
  FolderOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { SettingsModal } from "../settings/SettingsModal";
import { getAiSettings, type AiFeatures } from "../../lib/ai";

const NAV: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  to: string;
  feature?: keyof AiFeatures;
}[] = [
  { icon: ListTodo, label: "Tasks", to: "/" },
  { icon: StickyNote, label: "Notes", to: "/notes" },
  { icon: FolderOpen, label: "Projects", to: "/projects" },
  {
    icon: MessagesSquare,
    label: "Meeting",
    to: "/meeting",
    feature: "meetingMode",
  },
  { icon: BrainCircuit, label: "Luna", to: "/luna", feature: "lunaChat" },
  {
    icon: PenLine,
    label: "Writing",
    to: "/writing",
    feature: "writingAssistant",
  },
  { icon: Archive, label: "Archive", to: "/archive" },
];

function useAiFeatures(): AiFeatures {
  const [features, setFeatures] = useState(() => getAiSettings().features);
  useEffect(() => {
    const sync = () => setFeatures(getAiSettings().features);
    window.addEventListener("orbit:ai:changed", sync);
    return () => window.removeEventListener("orbit:ai:changed", sync);
  }, []);
  return features;
}

export function Sidebar() {
  const { user } = useAuth();
  const features = useAiFeatures();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);

  const visibleNav = NAV.filter(({ feature }) => !feature || features[feature]);

  const openSettings = () => {
    setSettingsKey((k) => k + 1);
    setSettingsOpen(true);
  };

  const name: string = user?.user_metadata?.full_name ?? user?.email ?? "User";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <>
      <aside className="w-17 shrink-0 hidden md:flex flex-col items-center bg-orbit-900/95 border-r border-white/6 sticky top-0 h-screen z-20 backdrop-blur-sm">
        {/* Logo mark */}
        <div className="py-4.5 flex items-center justify-center w-full border-b border-white/5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/9 flex items-center justify-center relative select-none">
            <div className="absolute inset-0 rounded-xl bg-violet-500/8 blur-lg" />
            <OrbitMark />
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex flex-col items-center gap-1 px-2.5 py-4 flex-1 w-full"
          role="navigation"
          aria-label="Main"
        >
          {visibleNav.map(({ icon: Icon, label, to }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `group relative flex items-center justify-center w-full aspect-square rounded-xl transition-all duration-200 focus-ring ${
                  isActive
                    ? "bg-violet-500/13 text-violet-400 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.13)]"
                    : "text-white/25 hover:text-white/75 hover:bg-white/6"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative flex items-center justify-center">
                    <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                    {isActive && (
                      <div className="absolute inset-0 rounded-full bg-violet-400/25 blur-xl scale-[3.5] pointer-events-none" />
                    )}
                  </div>
                  {/* Tooltip */}
                  <span className="pointer-events-none absolute left-[calc(100%+10px)] px-2.5 py-1.5 rounded-lg bg-orbit-800 border border-white/10 text-xs font-medium text-white/85 whitespace-nowrap shadow-xl shadow-black/50 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50">
                    {label}
                    {/* Tooltip arrow */}
                    <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-orbit-800" />
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User controls */}
        <div className="flex flex-col items-center gap-1 px-2.5 pb-4 pt-3 border-t border-white/5 w-full shrink-0">
          {/* Avatar → Settings */}
          <button
            onClick={openSettings}
            aria-label="Settings"
            className="group relative flex items-center justify-center w-full aspect-square rounded-xl text-white/40 hover:bg-white/6 transition-all duration-200 focus-ring"
          >
            <div className="w-7 h-7 rounded-full bg-linear-to-br from-violet-500/50 to-blue-500/50 border border-white/15 flex items-center justify-center text-[10px] font-bold text-white/80 select-none shadow-sm shadow-violet-500/20">
              {initials}
            </div>
            <span className="pointer-events-none absolute left-[calc(100%+10px)] px-2.5 py-1.5 rounded-lg bg-orbit-800 border border-white/10 text-xs font-medium text-white/85 whitespace-nowrap shadow-xl shadow-black/50 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50">
              Settings
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-orbit-800" />
            </span>
          </button>
        </div>
      </aside>
      <SettingsModal
        key={settingsKey}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

export function MobileNav() {
  const { user } = useAuth();
  const features = useAiFeatures();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const visibleNav = NAV.filter(({ feature }) => !feature || features[feature]);

  const name: string = user?.user_metadata?.full_name ?? user?.email ?? "User";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const openSettings = () => {
    setSettingsKey((k) => k + 1);
    setSettingsOpen(true);
    setMenuOpen(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (menuOpen) {
      setMenuMounted(true);
    } else if (menuMounted) {
      setMenuVisible(false);
      const timer = setTimeout(() => setMenuMounted(false), 220);
      return () => clearTimeout(timer);
    }
  }, [menuOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!menuMounted) return;
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setMenuVisible(true);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [menuMounted]);

  useEffect(() => {
    if (!menuMounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuMounted]);

  return (
    <>
      <div className="fixed top-0 right-0 left-0 z-40 md:hidden pointer-events-none">
        <div className="flex items-center justify-end px-4 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-2">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            className={`pointer-events-auto w-11 h-11 rounded-2xl bg-orbit-900/85 border border-white/8 text-white/70 hover:text-white hover:bg-orbit-900 transition-all duration-200 backdrop-blur-sm shadow-lg shadow-black/25 flex items-center justify-center focus-ring ${
              menuOpen ? "rotate-90 scale-[0.98]" : "rotate-0"
            }`}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {menuMounted && (
        <div
          className={`fixed inset-0 z-70 md:hidden bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.18),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.98),rgba(2,8,23,0.99))] backdrop-blur-xl transition-all duration-200 ease-out ${
            menuVisible ? "opacity-100" : "opacity-0"
          }`}
          role="navigation"
          aria-label="Mobile navigation"
        >
          <div
            className={`flex h-full flex-col px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] transition-all duration-200 ease-out ${
              menuVisible
                ? "opacity-100 translate-y-0 scale-100"
                : "opacity-0 translate-y-3 scale-[0.985]"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/25">
                  Orbit
                </p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                  Menu
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className="w-11 h-11 rounded-2xl bg-white/4 border border-white/8 text-white/70 hover:text-white hover:bg-white/7 transition-all duration-200 flex items-center justify-center focus-ring"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-8 flex-1 space-y-3 overflow-y-auto">
              {visibleNav.map(({ icon: Icon, label, to }) => (
                <NavLink
                  key={to}
                  to={to}
                  end
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-4 rounded-3xl border px-4 py-4 transition-all duration-200 focus-ring ${
                      isActive
                        ? "border-violet-400/28 bg-violet-500/12 text-white shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)]"
                        : "border-white/7 bg-white/3 text-white/72 hover:border-white/14 hover:bg-white/5"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-black/15">
                        <Icon size={19} strokeWidth={isActive ? 2.2 : 1.9} />
                        {isActive && (
                          <div className="absolute inset-0 rounded-2xl bg-violet-400/20 blur-xl scale-110 pointer-events-none" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold tracking-tight text-inherit">
                          {label}
                        </p>
                        <p className="mt-0.5 text-xs text-white/35">
                          Open {label.toLowerCase()}
                        </p>
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            <div className="pt-5 border-t border-white/7">
              <button
                type="button"
                onClick={openSettings}
                className="w-full flex items-center gap-4 rounded-3xl border border-white/7 bg-white/3 px-4 py-4 text-left text-white/72 hover:border-white/14 hover:bg-white/5 transition-all duration-200 focus-ring"
              >
                <div className="w-11 h-11 rounded-full bg-linear-to-br from-violet-500/55 to-blue-500/55 border border-white/15 flex items-center justify-center text-sm font-bold text-white/85 shadow-sm shadow-violet-500/20 shrink-0">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-semibold tracking-tight text-white/88">
                    Settings
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/35">
                    {name}
                  </p>
                </div>
                <Settings size={18} className="shrink-0 text-white/35" />
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        key={settingsKey}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </>
  );
}

function OrbitMark() {
  return (
    <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4 relative">
      <circle
        cx="9"
        cy="9"
        r="2.5"
        fill="rgba(139,92,246,0.15)"
        className="animate-pulse-soft"
      />
      <circle cx="9" cy="9" r="1.8" fill="white" />
      <ellipse
        cx="9"
        cy="9"
        rx="7.5"
        ry="3.3"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.45"
      />
      <ellipse
        cx="9"
        cy="9"
        rx="7.5"
        ry="3.3"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.45"
        transform="rotate(60 9 9)"
      />
      <ellipse
        cx="9"
        cy="9"
        rx="7.5"
        ry="3.3"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.45"
        transform="rotate(120 9 9)"
      />
    </svg>
  );
}
