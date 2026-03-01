import { useEffect, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ListTodo,
} from "lucide-react";
import { isPast, isToday, parseISO } from "date-fns";
import { useTasksApi } from "../components/layout/AppLayout";
import { TaskCard } from "../components/tasks/TaskCard";
import { CreateTaskModal } from "../components/tasks/CreateTaskModal";
import { EditTaskModal } from "../components/tasks/EditTaskModal";
import { Spinner } from "../components/ui/Spinner";
import type { Task } from "../types/database.types";

type Filter = "all" | "active" | "completed" | "overdue";
type Sort = "recent" | "priority" | "due";

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function isOverdue(task: Task) {
  return (
    !task.completed &&
    !!task.due_date &&
    isPast(parseISO(task.due_date)) &&
    !isToday(parseISO(task.due_date))
  );
}

export function DashboardPage() {
  const api = useTasksApi();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");

  useEffect(() => {
    api.fetchActiveTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = api.activeTasks.length;
    const completed = api.activeTasks.filter((t) => t.completed).length;
    const active = total - completed;
    const overdue = api.activeTasks.filter(isOverdue).length;
    return { total, completed, active, overdue };
  }, [api.activeTasks]);

  // ── Filtered + sorted tasks ───────────────────────────────────────────────
  const displayed = useMemo(() => {
    let tasks = [...api.activeTasks];

    if (filter === "active") tasks = tasks.filter((t) => !t.completed);
    else if (filter === "completed") tasks = tasks.filter((t) => t.completed);
    else if (filter === "overdue") tasks = tasks.filter(isOverdue);

    if (sort === "priority") {
      tasks.sort(
        (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      );
    } else if (sort === "due") {
      tasks.sort((a, b) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    }
    // 'recent' keeps the default created_at desc order from Supabase

    return tasks;
  }, [api.activeTasks, filter, sort]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleCreate = async (data: Parameters<typeof api.createTask>[0]) => {
    const ok = await api.createTask(data);
    if (ok) toast.success("Task created");
    else toast.error("Failed to create task");
    return ok;
  };

  const handleSave = async (
    id: string,
    data: Parameters<typeof api.updateTask>[1],
  ) => {
    const ok = await api.updateTask(id, data);
    if (ok) toast.success("Task updated");
    else toast.error("Failed to update task");
    return ok;
  };

  const handleToggle = async (id: string, completed: boolean) => {
    const ok = await api.toggleComplete(id, completed);
    if (!ok) toast.error("Failed to update task");
    return ok;
  };

  const handleArchive = async (id: string) => {
    const ok = await api.archiveTask(id);
    if (ok) toast.success("Task archived");
    else toast.error("Failed to archive task");
    return ok;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-white/30 mt-0.5 tracking-wide">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-orbit-950 text-xs font-bold rounded-xl hover:bg-white/90 active:scale-[0.97] transition-all"
        >
          <Plus size={14} />
          New task
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-7">
        <StatCard
          label="Total"
          value={stats.total}
          icon={<ListTodo size={14} />}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={<Circle size={14} />}
        />
        <StatCard
          label="Done"
          value={stats.completed}
          icon={<CheckCircle2 size={14} />}
          accent="emerald"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          icon={<AlertCircle size={14} />}
          accent={stats.overdue > 0 ? "red" : undefined}
        />
      </div>

      {/* Filter + sort bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-0.5 bg-white/3 border border-white/6 rounded-xl p-0.5">
          {(["all", "active", "completed", "overdue"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-white text-orbit-950"
                  : "text-white/35 hover:text-white/70"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-white/25">
          <Clock size={12} />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="bg-transparent text-white/40 text-xs outline-none cursor-pointer hover:text-white/70 transition-colors"
          >
            <option value="recent">Recent</option>
            <option value="priority">Priority</option>
            <option value="due">Due date</option>
          </select>
        </div>
      </div>

      {/* Task list */}
      {api.loadingActive ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={24} className="text-white/20" />
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState filter={filter} onNew={() => setCreateOpen(true)} />
      ) : (
        <div className="space-y-2">
          {displayed.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleComplete={handleToggle}
              onArchive={handleArchive}
              onEdit={setEditTask}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <EditTaskModal
        key={editTask?.id}
        task={editTask}
        onClose={() => setEditTask(null)}
        onSave={handleSave}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: "emerald" | "red";
}

function StatCard({ label, value, icon, accent }: StatCardProps) {
  const accentCls =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "red" && value > 0
        ? "text-red-400"
        : "text-white/70";

  return (
    <div className="bg-white/2.5 border border-white/6 rounded-xl px-4 py-3">
      <div className="flex items-center gap-1.5 text-white/25 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold">
          {label}
        </span>
      </div>
      <p className={`text-2xl font-bold ${accentCls}`}>{value}</p>
    </div>
  );
}

function EmptyState({ filter, onNew }: { filter: Filter; onNew: () => void }) {
  const msgs: Record<Filter, string> = {
    all: "No tasks yet. Create your first one.",
    active: "No active tasks.",
    completed: "No completed tasks yet.",
    overdue: "No overdue tasks. ",
  };
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/4 border border-white/6 flex items-center justify-center mb-4">
        <ListTodo size={20} className="text-white/20" />
      </div>
      <p className="text-white/30 text-sm">{msgs[filter]}</p>
      {filter === "all" && (
        <button
          onClick={onNew}
          className="mt-4 flex items-center gap-1.5 px-4 py-2 border border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 rounded-xl text-sm transition-colors"
        >
          <Plus size={14} />
          Create task
        </button>
      )}
    </div>
  );
}
