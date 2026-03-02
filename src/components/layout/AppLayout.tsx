import { Outlet, useOutletContext } from "react-router-dom";
import { StarField } from "../ui/StarField";
import { Sidebar, MobileNav } from "./Sidebar";
import { useTasks, type TasksApi } from "../../hooks/useTasks";
import { useAuth } from "../../contexts/AuthContext";
import { UnlockModal } from "../auth/UnlockModal";

export function AppLayout() {
  const { user, encryptionKey, isLocked } = useAuth();
  const tasksApi = useTasks(user!.id, encryptionKey);

  return (
    <div className="min-h-screen flex bg-orbit-950 relative">
      <StarField />
      {/* Subtle nebula glow */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-1/4 w-150 h-100 bg-violet-500/2 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-125 h-125 bg-blue-500/1.5 rounded-full blur-[100px]" />
      </div>
      {isLocked && <UnlockModal />}
      <Sidebar />
      <MobileNav />
      <main className="flex-1 min-w-0 relative pb-16 md:pb-0">
        <Outlet context={tasksApi} />
      </main>
    </div>
  );
}

export function useTasksApi() {
  return useOutletContext<TasksApi>();
}
