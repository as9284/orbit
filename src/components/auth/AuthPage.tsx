import { useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "../../lib/supabase";
import { StarField } from "../ui/StarField";
import { Spinner } from "../ui/Spinner";
import {
  validateEmail,
  validatePassword,
  validateFullName,
  validateConfirmPassword,
} from "../../lib/validations";
import { generateSalt, deriveKey } from "../../lib/encryption";
import { useAuth } from "../../contexts/AuthContext";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

type Mode = "signin" | "signup";

export function AuthPage() {
  const { setEncryptionKey } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // null = no animation (initial render), "right" = slide from right, "left" = slide from left
  const [slideDir, setSlideDir] = useState<"right" | "left" | null>(null);

  // Sign-in state
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siErrors, setSiErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  // Sign-up state
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirm, setSuConfirm] = useState("");
  const [suErrors, setSuErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});

  const switchMode = (m: Mode) => {
    setSlideDir(m === "signup" ? "right" : "left");
    setMode(m);
    setGlobalError(null);
    setSuccessMsg(null);
    setSiErrors({});
    setSuErrors({});
  };

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    const errs = {
      email: validateEmail(siEmail) ?? undefined,
      password: siPassword ? undefined : "Password is required",
    };
    if (errs.email || errs.password) {
      setSiErrors(errs);
      return;
    }
    setLoading(true);
    setGlobalError(null);
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email: siEmail.trim().toLowerCase(),
      password: siPassword,
    });
    if (error) {
      setLoading(false);
      if (error.message.includes("Invalid login credentials")) {
        setGlobalError("Incorrect email or password.");
      } else if (error.message.includes("Email not confirmed")) {
        setGlobalError("Please confirm your email before signing in.");
      } else {
        setGlobalError(error.message);
      }
      return;
    }
    // Derive encryption key from password + stored salt
    if (signInData.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("encryption_salt")
        .eq("id", signInData.user.id)
        .single();
      if (profile?.encryption_salt) {
        const key = await deriveKey(siPassword, profile.encryption_salt);
        await setEncryptionKey(key);
      }
    }
    setLoading(false);
    // AuthContext picks up the new session automatically
  };

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    const errs = {
      name: validateFullName(suName) ?? undefined,
      email: validateEmail(suEmail) ?? undefined,
      password: validatePassword(suPassword) ?? undefined,
      confirm: validateConfirmPassword(suPassword, suConfirm) ?? undefined,
    };
    if (errs.name || errs.email || errs.password || errs.confirm) {
      setSuErrors(errs);
      return;
    }
    setLoading(true);
    setGlobalError(null);
    const { data, error } = await supabase.auth.signUp({
      email: suEmail.trim().toLowerCase(),
      password: suPassword,
      options: { data: { full_name: suName.trim() } },
    });
    if (error) {
      setLoading(false);
      if (error.message.toLowerCase().includes("already registered")) {
        setGlobalError(
          "An account with this email already exists. Try signing in.",
        );
      } else {
        setGlobalError(error.message);
      }
      return;
    }
    // Generate salt and derive encryption key for the new user
    if (data.user) {
      const salt = generateSalt();
      await supabase
        .from("profiles")
        .update({ encryption_salt: salt })
        .eq("id", data.user.id);
      const key = await deriveKey(suPassword, salt);
      await setEncryptionKey(key);
    }
    setLoading(false);
    if (data.session === null) {
      setSuccessMsg(
        "Account created! Check your email to confirm your account before signing in.",
      );
    }
    // If session is not null, AuthContext picks up the session
  };

  return (
    <div className="min-h-screen bg-orbit-950 flex items-center justify-center p-4 relative overflow-hidden">
      <StarField />

      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="w-[600px] h-[600px] rounded-full bg-violet-500/[0.06] blur-[120px]" />
      </div>
      <div
        className="pointer-events-none absolute -top-40 -right-40"
        aria-hidden="true"
      >
        <div className="w-[500px] h-[500px] rounded-full bg-blue-500/[0.04] blur-[100px]" />
      </div>
      <div
        className="pointer-events-none absolute bottom-0 left-1/4"
        aria-hidden="true"
      >
        <div className="w-[400px] h-[400px] rounded-full bg-indigo-500/[0.03] blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Branding */}
        <div
          className="flex flex-col items-center mb-10 select-none animate-slide-up"
          style={{ animationDelay: "50ms", animationFillMode: "backwards" }}
        >
          <div className="w-14 h-14 rounded-2xl bg-white/[0.06] border border-white/[0.12] flex items-center justify-center mb-4 relative">
            <div className="absolute inset-0 rounded-2xl bg-violet-500/15 blur-lg animate-pulse-soft" />
            <OrbitMark />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Orbit
          </h1>
          <p className="text-[11px] text-white/35 mt-1 tracking-[0.2em] uppercase">
            Your personal task universe
          </p>
        </div>

        {/* Card */}
        <div
          className="bg-orbit-800/90 border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl shadow-black/60 backdrop-blur-sm animate-slide-up relative"
          style={{ animationDelay: "150ms", animationFillMode: "backwards" }}
        >
          {/* Subtle top glow */}
          <div className="absolute -top-px left-1/4 right-1/4 h-px bg-linear-to-r from-transparent via-violet-400/30 to-transparent" />
          {/* Mode tabs */}
          <div className="flex border-b border-white/[0.06]" role="tablist">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-3.5 text-xs font-semibold tracking-widest uppercase transition-all duration-200 ${
                  mode === m
                    ? "text-white border-b-2 border-violet-400"
                    : "text-white/35 hover:text-white/65"
                }`}
              >
                {m === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          {/* Loading bar — thin violet line below tabs while request in flight */}
          {loading && (
            <div className="h-px overflow-hidden">
              <div className="h-full bg-linear-to-r from-transparent via-violet-400/70 to-transparent animate-pulse" />
            </div>
          )}

          <div className="p-6 sm:p-7 space-y-4">
            {/* Alerts */}
            {successMsg && (
              <Alert
                icon={<CheckCircle2 size={14} />}
                color="emerald"
                msg={successMsg}
              />
            )}
            {globalError && (
              <Alert
                icon={<AlertCircle size={14} />}
                color="red"
                msg={globalError}
              />
            )}

            {/* Slide-animated form area — key={mode} forces remount on tab switch */}
            <div
              key={mode}
              className={
                slideDir === "right"
                  ? "animate-slide-in-right"
                  : slideDir === "left"
                    ? "animate-slide-in-left"
                    : ""
              }
            >
              {mode === "signin" ? (
                <form onSubmit={handleSignIn} noValidate className="space-y-3">
                  <Field
                    label="Email"
                    icon={<Mail size={13} />}
                    error={siErrors.email}
                  >
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={siEmail}
                      onChange={(e) => {
                        setSiEmail(e.target.value);
                        setSiErrors((p) => ({ ...p, email: undefined }));
                      }}
                      className={fieldInput(!!siErrors.email)}
                    />
                  </Field>

                  <Field
                    label="Password"
                    icon={<Lock size={13} />}
                    error={siErrors.password}
                    action={
                      <ToggleEye
                        show={showPwd}
                        onToggle={() => setShowPwd((v) => !v)}
                      />
                    }
                  >
                    <input
                      type={showPwd ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={siPassword}
                      onChange={(e) => {
                        setSiPassword(e.target.value);
                        setSiErrors((p) => ({ ...p, password: undefined }));
                      }}
                      className={fieldInput(!!siErrors.password)}
                    />
                  </Field>

                  <SubmitBtn loading={loading} label="Sign in" />
                </form>
              ) : (
                <form onSubmit={handleSignUp} noValidate className="space-y-3">
                  {" "}
                  <Field
                    label="Full name"
                    icon={<User size={13} />}
                    error={suErrors.name}
                  >
                    <input
                      type="text"
                      autoComplete="name"
                      placeholder="Ada Lovelace"
                      value={suName}
                      onChange={(e) => {
                        setSuName(e.target.value);
                        setSuErrors((p) => ({ ...p, name: undefined }));
                      }}
                      className={fieldInput(!!suErrors.name)}
                    />
                  </Field>
                  <Field
                    label="Email"
                    icon={<Mail size={13} />}
                    error={suErrors.email}
                  >
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={suEmail}
                      onChange={(e) => {
                        setSuEmail(e.target.value);
                        setSuErrors((p) => ({ ...p, email: undefined }));
                      }}
                      className={fieldInput(!!suErrors.email)}
                    />
                  </Field>
                  <Field
                    label="Password"
                    icon={<Lock size={13} />}
                    error={suErrors.password}
                    action={
                      <ToggleEye
                        show={showPwd}
                        onToggle={() => setShowPwd((v) => !v)}
                      />
                    }
                  >
                    <input
                      type={showPwd ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="8+ chars, uppercase, number, symbol"
                      value={suPassword}
                      onChange={(e) => {
                        setSuPassword(e.target.value);
                        setSuErrors((p) => ({ ...p, password: undefined }));
                      }}
                      className={fieldInput(!!suErrors.password)}
                    />
                  </Field>
                  <Field
                    label="Confirm password"
                    icon={<Lock size={13} />}
                    error={suErrors.confirm}
                    action={
                      <ToggleEye
                        show={showConfirm}
                        onToggle={() => setShowConfirm((v) => !v)}
                      />
                    }
                  >
                    <input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      value={suConfirm}
                      onChange={(e) => {
                        setSuConfirm(e.target.value);
                        setSuErrors((p) => ({ ...p, confirm: undefined }));
                      }}
                      className={fieldInput(!!suErrors.confirm)}
                    />
                  </Field>
                  {suPassword && <StrengthBar password={suPassword} />}
                  <SubmitBtn loading={loading} label="Create account" />
                </form>
              )}
            </div>
          </div>
        </div>

        <p
          className="text-center text-white/20 text-[11px] mt-8 tracking-[0.15em] uppercase animate-fade-in flex items-center justify-center gap-2"
          style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
        >
          <Lock size={10} className="text-violet-400/40" />
          End-to-end encrypted
        </p>
      </div>
    </div>
  );
}

// ─── Small reusables ─────────────────────────────────────────────────────────

function OrbitMark() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="w-6 h-6 relative">
      <circle cx="10" cy="10" r="2.2" fill="white" />
      <circle
        cx="10"
        cy="10"
        r="3"
        fill="rgba(139,92,246,0.15)"
        className="animate-pulse-soft"
      />
      <ellipse
        cx="10"
        cy="10"
        rx="8"
        ry="3.6"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="1"
      />
      <ellipse
        cx="10"
        cy="10"
        rx="8"
        ry="3.6"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="1"
        transform="rotate(60 10 10)"
      />
      <ellipse
        cx="10"
        cy="10"
        rx="8"
        ry="3.6"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="1"
        transform="rotate(120 10 10)"
      />
    </svg>
  );
}

function fieldInput(hasError: boolean) {
  return `w-full bg-transparent text-white text-sm placeholder:text-white/25 outline-none ${hasError ? "placeholder:text-red-400/40" : ""}`;
}

interface FieldProps {
  label: string;
  icon: ReactNode;
  error?: string;
  children: ReactNode;
  action?: ReactNode;
}
function Field({ label, icon, error, children, action }: FieldProps) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-white/40 mb-1.5">
        {label}
      </label>
      <div
        className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-all duration-200 ${
          error
            ? "border-red-500/40 bg-red-500/5"
            : "border-white/[0.08] bg-white/[0.04] focus-within:border-violet-500/40 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.06)]"
        }`}
      >
        <span className="text-white/30 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">{children}</div>
        {action && <span className="shrink-0">{action}</span>}
      </div>
      {error && <p className="mt-1.5 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

interface AlertProps {
  icon: ReactNode;
  color: "emerald" | "red";
  msg: string;
}
function Alert({ icon, color, msg }: AlertProps) {
  const cls =
    color === "emerald"
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
      : "bg-red-500/10 border-red-500/20 text-red-400";
  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-xl border text-xs animate-fade-in ${cls}`}
      role="alert"
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      {msg}
    </div>
  );
}

function ToggleEye({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      onClick={onToggle}
      aria-label={show ? "Hide password" : "Show password"}
      className="text-white/30 hover:text-white/60 transition-colors p-0.5"
    >
      {show ? <EyeOff size={14} /> : <Eye size={14} />}
    </button>
  );
}

function SubmitBtn({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 mt-2 bg-linear-to-r from-violet-500 to-blue-500 text-white text-sm font-semibold rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20 focus-ring"
    >
      {loading && <Spinner size={14} className="text-white" />}
      {label}
    </button>
  );
}

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const colors = [
    "bg-red-500",
    "bg-orange-400",
    "bg-yellow-400",
    "bg-emerald-400",
  ];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  return (
    <div className="space-y-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className={`h-0.5 flex-1 rounded-full transition-all duration-300 ${
              n <= score ? colors[score - 1] : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="text-[10px] text-white/25">
        Strength:{" "}
        <span
          className={
            score <= 1
              ? "text-red-400"
              : score === 2
                ? "text-orange-400"
                : score === 3
                  ? "text-yellow-400"
                  : "text-emerald-400"
          }
        >
          {labels[score - 1] ?? "—"}
        </span>
      </p>
    </div>
  );
}
