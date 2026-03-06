import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { AuthPage } from "./components/auth/AuthPage";
import { AppLayout } from "./components/layout/AppLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ArchivePage } from "./pages/ArchivePage";
import { NotesPage } from "./pages/NotesPage";
import { LunaPage } from "./pages/LunaPage";
import { Spinner } from "./components/ui/Spinner";
import { RouteMetadata } from "./components/seo/RouteMetadata";

function AppContent() {
  const { user, loading } = useAuth();

  const authState = loading ? "loading" : user ? "authenticated" : "anonymous";

  if (loading) {
    return (
      <>
        <RouteMetadata authState={authState} />
        <div className="min-h-screen flex items-center justify-center bg-orbit-950">
          <Spinner size={28} className="text-white/20" />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <RouteMetadata authState={authState} />
        <AuthPage />
      </>
    );
  }

  return (
    <>
      <RouteMetadata authState={authState} />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="notes" element={<NotesPage />} />
          <Route path="luna" element={<LunaPage />} />
          <Route path="archive" element={<ArchivePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#0c0e18",
            color: "#f1f5f9",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: "14px",
            fontSize: "13px",
            fontFamily: "Inter, system-ui, sans-serif",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          },
          success: {
            iconTheme: { primary: "#34d399", secondary: "#0c0e18" },
          },
          error: {
            iconTheme: { primary: "#f87171", secondary: "#0c0e18" },
          },
        }}
      />
    </AuthProvider>
  );
}
