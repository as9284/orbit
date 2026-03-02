import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  setEncryptionKey: (key: CryptoKey) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [encryptionKey, setKeyState] = useState<CryptoKey | null>(null);
  // Ref so the onAuthStateChange closure can read the latest key synchronously.
  const encryptionKeyRef = useRef<CryptoKey | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const key = await loadKeyFromSession();
        if (key) {
          encryptionKeyRef.current = key;
          setKeyState(key);
        }
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (!session) {
        clearKeyFromSession();
        encryptionKeyRef.current = null;
        setKeyState(null);
        return;
      }

      if (event === "SIGNED_IN" && !encryptionKeyRef.current) {
        // Try to restore the key from sessionStorage (covers token-refresh
        // timing on page reload). AuthPage handles fresh sign-in derivation
        // via setEncryptionKey(), so if the key is already being derived this
        // is a no-op.
        const savedKey = await loadKeyFromSession();
        if (savedKey) {
          encryptionKeyRef.current = savedKey;
          setKeyState(savedKey);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const setEncryptionKey = async (key: CryptoKey) => {
    encryptionKeyRef.current = key;
    setKeyState(key);
    await saveKeyToSession(key);
  };

  const signOut = async () => {
    clearKeyFromSession();
    encryptionKeyRef.current = null;
    setKeyState(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        encryptionKey,
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
