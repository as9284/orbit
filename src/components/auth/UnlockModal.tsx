import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import { deriveKey } from "../../lib/encryption";
import { useAuth } from "../../contexts/AuthContext";
import { Spinner } from "../ui/Spinner";
import { Lock, Eye, EyeOff } from "lucide-react";

export function UnlockModal() {
  const { user, setEncryptionKey, signOut } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password || !user) return;

    setLoading(true);
    setError(null);

    // Verify the password by attempting a re-auth
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password,
    });
    if (authErr) {
      setLoading(false);
      setError("Incorrect password.");
      return;
    }

    // Fetch the salt and derive the key
    const { data: profile } = await supabase
      .from("profiles")
      .select("encryption_salt")
      .eq("id", user.id)
      .single();

    if (!profile?.encryption_salt) {
      setLoading(false);
      setError("Encryption salt missing. Please contact support.");
      return;
    }

    const key = await deriveKey(password, profile.encryption_salt);
    await setEncryptionKey(key);
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-orbit-950/90 backdrop-blur-sm">
      <div className="w-full max-w-xs bg-orbit-800/95 border border-white/[0.07] rounded-2xl shadow-2xl shadow-black/70 p-6">
        <div className="flex flex-col items-center mb-5">
          <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-3">
            <Lock size={18} className="text-violet-400" />
          </div>
          <h2 className="text-sm font-bold text-white tracking-tight">
            Vault locked
          </h2>
          <p className="text-xs text-white/30 mt-0.5 text-center">
            Enter your password to decrypt your tasks
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-3">
          <div>
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                error
                  ? "border-red-500/40 bg-red-500/5"
                  : "border-white/[0.07] bg-white/3 focus-within:border-violet-500/30 focus-within:bg-white/5"
              }`}
            >
              <Lock size={13} className="text-white/25 shrink-0" />
              <input
                type={showPwd ? "text" : "password"}
                autoFocus
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                className="flex-1 min-w-0 bg-transparent text-white text-sm placeholder:text-white/20 outline-none"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPwd((v) => !v)}
                className="text-white/25 hover:text-white/60 transition-colors shrink-0"
              >
                {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            {error && (
              <p className="mt-1.5 text-[11px] text-red-400">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2.5 bg-white text-orbit-950 text-sm font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-ring"
          >
            {loading && <Spinner size={14} className="text-orbit-950" />}
            Unlock
          </button>

          <button
            type="button"
            onClick={signOut}
            className="w-full py-2 text-xs text-white/25 hover:text-white/50 transition-colors"
          >
            Sign out instead
          </button>
        </form>
      </div>
    </div>
  );
}
