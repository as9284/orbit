import { NavLink } from "react-router-dom";
import { LayoutDashboard, Archive, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { SettingsModal } from "../settings/SettingsModal";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: Archive, label: "Archive", to: "/archive" },
];

export function Sidebar() {
  const { user, signOut } = useAuth();
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
      <aside className="w-56 shrink-0 hidden md:flex flex-col bg-orbit-900 border-r border-white/4 sticky top-0 h-screen z-20">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/4">
          <div className="flex items-center gap-3 select-none">
            <div className="w-8 h-8 rounded-xl bg-white/6 border border-white/8 flex items-center justify-center shrink-0">
              <OrbitMark />
            </div>
            <div>
              <span className="text-sm font-bold tracking-tight text-white block">
                Orbit
              </span>
              <span className="text-[9px] text-white/20 tracking-[0.2em] uppercase">
                Task Universe
              </span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 px-3 py-4 space-y-1"
          role="navigation"
          aria-label="Main"
        >
          {NAV.map(({ icon: Icon, label, to }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 focus-ring ${
                  isActive
                    ? "bg-white/8 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
                    : "text-white/30 hover:text-white/70 hover:bg-white/4"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div
                    className={`relative flex items-center justify-center ${isActive ? "text-violet-400" : ""}`}
                  >
                    <Icon size={16} />
                    {isActive && (
                      <div className="absolute inset-0 rounded-full bg-violet-400/20 blur-md scale-[2.5]" />
                    )}
                  </div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User area */}
        <div className="px-3 pb-4 border-t border-white/4 pt-4">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-linear-to-br from-violet-500/20 to-blue-500/20 border border-white/8 flex items-center justify-center text-[10px] font-bold text-white/60 shrink-0 select-none">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white/50 truncate">
                {name}
              </p>
            </div>
            <button
              onClick={() => openSettings()}
              title="Settings"
              aria-label="Settings"
              className="p-1.5 rounded-lg text-white/15 hover:text-white/50 hover:bg-white/4 transition-all duration-200 focus-ring"
            >
              <Settings size={14} />
            </button>
            <button
              onClick={signOut}
              title="Sign out"
              aria-label="Sign out"
              className="p-1.5 rounded-lg text-white/15 hover:text-white/50 hover:bg-white/4 transition-all duration-200 focus-ring"
            >
              <LogOut size={14} />
            </button>
          </div>
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
  const { signOut } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsKey, setSettingsKey] = useState(0);

  const openSettings = () => {
    setSettingsKey((k) => k + 1);
    setSettingsOpen(true);
  };
  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center bg-orbit-900 border-t border-white/6 px-2"
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
                  : "text-white/25 hover:text-white/60"
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
          className="flex flex-col items-center gap-1 py-3 px-4 text-[10px] font-semibold tracking-wider uppercase text-white/25 hover:text-white/60 transition-colors focus-ring rounded-xl"
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button
          onClick={signOut}
          aria-label="Sign out"
          className="flex flex-col items-center gap-1 py-3 px-4 text-[10px] font-semibold tracking-wider uppercase text-white/25 hover:text-white/60 transition-colors focus-ring rounded-xl"
        >
          <LogOut size={18} />
          <span>Sign out</span>
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
    <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4">
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
        opacity="0.4"
      />
      <ellipse
        cx="9"
        cy="9"
        rx="7.5"
        ry="3.3"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.4"
        transform="rotate(60 9 9)"
      />
      <ellipse
        cx="9"
        cy="9"
        rx="7.5"
        ry="3.3"
        stroke="white"
        strokeWidth="0.8"
        opacity="0.4"
        transform="rotate(120 9 9)"
      />
    </svg>
  );
}
