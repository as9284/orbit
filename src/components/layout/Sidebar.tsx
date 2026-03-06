import { NavLink } from "react-router-dom";
import {
  ListTodo,
  Archive,
  Settings,
  StickyNote,
  BrainCircuit,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { SettingsModal } from "../settings/SettingsModal";

const NAV = [
  { icon: ListTodo, label: "Tasks", to: "/" },
  { icon: StickyNote, label: "Notes", to: "/notes" },
  { icon: BrainCircuit, label: "Luna", to: "/luna" },
  { icon: Archive, label: "Archive", to: "/archive" },
];

export function Sidebar() {
  const { user } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);

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
          {NAV.map(({ icon: Icon, label, to }) => (
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);

  const openSettings = () => {
    setSettingsKey((k) => k + 1);
    setSettingsOpen(true);
  };
  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-stretch bg-orbit-900/95 border-t border-white/[0.07] backdrop-blur-sm pb-[env(safe-area-inset-bottom)]"
        role="navigation"
        aria-label="Mobile navigation"
      >
        {NAV.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold tracking-wider uppercase transition-all duration-200 focus-ring rounded-xl ${
                isActive
                  ? "text-violet-400"
                  : "text-white/30 active:text-white/60"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative flex items-center justify-center">
                  <Icon size={18} />
                  {isActive && (
                    <div className="absolute inset-0 rounded-full bg-violet-400/20 blur-md scale-[2]" />
                  )}
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => openSettings()}
          aria-label="Settings"
          className="flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-semibold tracking-wider uppercase text-white/30 active:text-white/60 transition-colors focus-ring rounded-xl"
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
      </nav>
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
