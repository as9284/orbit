import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  ListTodo,
  Sparkles,
  ChevronDown,
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

const SORT_LABELS: Record<Sort, string> = {
  recent: "Recent",
  priority: "Priority",
  due: "Due date",
};

function isOverdue(task: Task) {
  return (
    !task.completed &&
    !!task.due_date &&
    isPast(parseISO(task.due_date)) &&
    !isToday(parseISO(task.due_date))
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const api = useTasksApi();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("recent");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.fetchActiveTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: N to create new task
  const openCreate = useCallback(() => setCreateOpen(true), []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "n" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !createOpen &&
        !editTask
      ) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCreate, createOpen, editTask]);

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sortOpen]);

  const stats = useMemo(() => {
    const total = api.activeTasks.length;
    const completed = api.activeTasks.filter((t) => t.completed).length;
    const active = total - completed;
    const overdue = api.activeTasks.filter(isOverdue).length;
    return { total, completed, active, overdue };
  }, [api.activeTasks]);

  const progressPercent =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

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

    return tasks;
  }, [api.activeTasks, filter, sort]);

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 animate-fade-in">
      {/* Page header */}
      <div className="flex items-end justify-between mb-6 sm:mb-10">
        <div className="animate-slide-up">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {getGreeting()}
          </h1>
          <p className="text-sm text-white/30 mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-white text-orbit-950 text-sm font-bold rounded-xl hover:bg-white/90 active:scale-[0.97] transition-all duration-150 shadow-lg shadow-white/5 focus-ring"
        >
          <Plus size={16} strokeWidth={2.5} />
          New task
          <kbd className="ml-1 text-[10px] font-medium text-orbit-400 bg-orbit-100/80 px-1.5 py-0.5 rounded hidden sm:inline">
            N
          </kbd>
        </button>
      </div>

      {/* Stats + Progress */}
      <div className="mb-8 animate-fade-in" style={{ animationDelay: "50ms" }}>
        {/* Progress bar */}
        {stats.total > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-white/30 font-medium">
                Progress
              </span>
              <span className="text-xs text-white/50 font-semibold tabular-nums">
                {progressPercent}%
              </span>
            </div>
            <div className="h-1.5 bg-white/4 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total"
            value={stats.total}
            icon={<ListTodo size={14} />}
            color="border-l-white/10"
          />
          <StatCard
            label="Active"
            value={stats.active}
            icon={<Circle size={14} />}
            color="border-l-blue-500/30"
          />
          <StatCard
            label="Done"
            value={stats.completed}
            icon={<CheckCircle2 size={14} />}
            color="border-l-emerald-500/40"
            valueColor="text-emerald-400"
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon={<AlertCircle size={14} />}
            color={
              stats.overdue > 0 ? "border-l-red-500/40" : "border-l-white/10"
            }
            valueColor={stats.overdue > 0 ? "text-red-400" : undefined}
          />
        </div>
      </div>

      {/* Filter + sort bar */}
      <div
        className="relative z-20 flex flex-wrap items-center justify-between gap-y-2 mb-4 sm:mb-5 animate-fade-in"
        style={{ animationDelay: "100ms" }}
      >
        <div
          className="flex items-center gap-1 bg-white/5 border border-white/6 rounded-xl p-1"
          role="tablist"
          aria-label="Task filters"
        >
          {(["all", "active", "completed", "overdue"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              role="tab"
              aria-selected={filter === f}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200 focus-ring ${
                filter === f
                  ? "bg-white text-orbit-950 shadow-sm"
                  : "text-white/30 hover:text-white/60 hover:bg-white/3"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div ref={sortRef} className="relative">
          <button
            onClick={() => setSortOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={sortOpen}
            aria-label="Sort tasks"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 focus-ring ${
              sortOpen
                ? "text-white/70 bg-white/6"
                : "text-white/40 hover:text-white/70 hover:bg-white/4"
            }`}
          >
            <Clock size={12} />
            {SORT_LABELS[sort]}
            <ChevronDown
              size={11}
              className={`transition-transform duration-200 ${
                sortOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {sortOpen && (
            <div
              role="listbox"
              aria-label="Sort options"
              className="absolute right-0 top-full mt-1.5 w-32 bg-orbit-900 border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50 animate-scale-in"
            >
              {(["recent", "priority", "due"] as Sort[]).map((s) => (
                <button
                  key={s}
                  role="option"
                  aria-selected={sort === s}
                  onClick={() => {
                    setSort(s);
                    setSortOpen(false);
                  }}
                  className={`w-full text-left px-3.5 py-2.5 text-xs font-medium transition-colors duration-150 ${
                    sort === s
                      ? "text-white bg-white/10"
                      : "text-white/50 hover:text-white hover:bg-white/6"
                  }`}
                >
                  {SORT_LABELS[s]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Task list */}
      {api.loadingActive ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size={24} className="text-white/20" />
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState filter={filter} onNew={openCreate} />
      ) : (
        <div className="space-y-2">
          {displayed.map((task, i) => (
            <div
              key={task.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(i * 40, 400) + 120}ms` }}
            >
              <TaskCard
                task={task}
                onToggleComplete={handleToggle}
                onArchive={handleArchive}
                onEdit={setEditTask}
              />
            </div>
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
  color: string;
  valueColor?: string;
}

function StatCard({ label, value, icon, color, valueColor }: StatCardProps) {
  return (
    <div
      className={`relative bg-white/3 border border-white/6 border-l-2 ${color} rounded-2xl px-4 py-4 overflow-hidden hover:bg-white/5 hover:border-white/8 transition-all duration-300 group`}
    >
      <div className="flex items-center gap-1.5 text-white/25 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-widest font-semibold">
          {label}
        </span>
      </div>
      <p
        className={`text-2xl font-bold tabular-nums ${valueColor ?? "text-white/70"}`}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyState({ filter, onNew }: { filter: Filter; onNew: () => void }) {
  const msgs: Record<Filter, string> = {
    all: "No tasks yet. Create your first one to get started.",
    active: "No active tasks right now.",
    completed: "No completed tasks yet.",
    overdue: "No overdue tasks — you're on track!",
  };
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/6 flex items-center justify-center mb-5 animate-float">
        {filter === "all" ? (
          <Sparkles size={22} className="text-violet-400/40" />
        ) : (
          <ListTodo size={22} className="text-white/15" />
        )}
      </div>
      <p className="text-white/30 text-sm font-medium">{msgs[filter]}</p>
      {filter === "all" && (
        <button
          onClick={onNew}
          className="mt-5 flex items-center gap-2 px-5 py-2.5 border border-white/8 text-white/40 hover:text-white/70 hover:border-white/20 hover:bg-white/3 rounded-xl text-sm font-medium transition-all duration-200 focus-ring"
        >
          <Plus size={15} />
          Create your first task
        </button>
      )}
    </div>
  );
}
