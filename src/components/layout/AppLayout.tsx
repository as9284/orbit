import { Outlet, useOutletContext } from "react-router-dom";
import { StarField } from "../ui/StarField";
import { Sidebar } from "./Sidebar";
import { useTasks, type TasksApi } from "../../hooks/useTasks";
import { useAuth } from "../../contexts/AuthContext";

export function AppLayout() {
  const { user } = useAuth();
  const tasksApi = useTasks(user!.id);

  return (
    <div className="h-full flex bg-orbit-950 overflow-hidden relative">
      <StarField />
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto relative z-10">
        <Outlet context={tasksApi} />
      </main>
    </div>
  );
}

// Typed outlet context helper
export function useTasksApi() {
  return useOutletContext<TasksApi>();
}
