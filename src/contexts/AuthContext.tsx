import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import {
  loadKeyFromSession,
  saveKeyToSession,
  clearKeyFromSession,
} from "../lib/encryption";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  encryptionKey: CryptoKey | null;
  /** true when user is authenticated but encryption key is not yet available */
  isLocked: boolean;
  setEncryptionKey: (key: CryptoKey) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [encryptionKey, setKeyState] = useState<CryptoKey | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const key = await loadKeyFromSession();
        if (key) setKeyState(key);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (!session) {
        clearKeyFromSession();
        setKeyState(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setEncryptionKey = async (key: CryptoKey) => {
    setKeyState(key);
    await saveKeyToSession(key);
  };

  const signOut = async () => {
    clearKeyFromSession();
    setKeyState(null);
    await supabase.auth.signOut();
  };

  const isLocked = !!user && !encryptionKey;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        encryptionKey,
        isLocked,
        setEncryptionKey,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
