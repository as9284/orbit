import { NavLink } from "react-router-dom";
import { LayoutDashboard, Archive, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard", to: "/" },
  { icon: Archive, label: "Archive", to: "/archive" },
];

export function Sidebar() {
  const { user, signOut } = useAuth();

  const name: string = user?.user_metadata?.full_name ?? user?.email ?? "User";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <aside className="w-52 shrink-0 flex flex-col bg-orbit-900/50 backdrop-blur-sm border-r border-white/5 relative z-20">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-white/4">
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-7 h-7 rounded-lg bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0">
            <OrbitMark />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">
            Orbit
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5">
        {NAV.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-white/8 text-white font-semibold"
                  : "text-white/35 hover:text-white/70 hover:bg-white/4"
              }`
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User area */}
      <div className="px-2.5 pb-3 border-t border-white/4 pt-3">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-white/[0.07] border border-white/10 flex items-center justify-center text-[10px] font-bold text-white/50 shrink-0 select-none">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/55 truncate">{name}</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="text-white/20 hover:text-white/55 transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function OrbitMark() {
  return (
    <svg viewBox="0 0 18 18" fill="none" className="w-3.5 h-3.5">
      <circle cx="9" cy="9" r="1.8" fill="white" />
      <ellipse
        cx="9"
        cy="9"
        rx="7.5"
        ry="3.3"
        stroke="white"
        strokeWidth="1.1"
      />
      <ellipse
        cx="9"
        cy="9"
        rx="7.5"
        ry="3.3"
        stroke="white"
        strokeWidth="1.1"
        transform="rotate(60 9 9)"
      />
      <ellipse
        cx="9"
        cy="9"
        rx="7.5"
        ry="3.3"
        stroke="white"
        strokeWidth="1.1"
        transform="rotate(120 9 9)"
      />
    </svg>
  );
}
