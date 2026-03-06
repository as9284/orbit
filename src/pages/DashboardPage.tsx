import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Sparkles,
  ChevronDown,
  Tag,
  X,
  ListTodo,
} from "lucide-react";
import { isFeatureReady } from "../lib/ai";
import { isPast, isToday, parseISO } from "date-fns";
import { useTasksApi } from "../components/layout/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { TaskCard } from "../components/tasks/TaskCard";
import { CreateTaskModal } from "../components/tasks/CreateTaskModal";
import { EditTaskModal } from "../components/tasks/EditTaskModal";
import { TaskPreviewModal } from "../components/tasks/TaskPreviewModal";
import { Spinner } from "../components/ui/Spinner";
import type { Task } from "../types/database.types";
import type { SubTaskInput } from "../hooks/useTasks";

type Filter = "active" | "overdue";
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

function sanitizeStoredFilter(value: string | null): Filter {
  return value === "overdue" ? "overdue" : "active";
}

export function DashboardPage() {
  const api = useTasksApi();
  const { encryptionKey } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);

  // Re-render when AI settings change so feature checks update immediately
  const [, setAiTick] = useState(0);
  useEffect(() => {
    const handler = () => setAiTick((t) => t + 1);
    window.addEventListener("orbit:ai:changed", handler);
    return () => window.removeEventListener("orbit:ai:changed", handler);
  }, []);

  const [filter, setFilter] = useState<Filter>(() => {
    return sanitizeStoredFilter(localStorage.getItem("orbit:dashboard:filter"));
  });
  const [sort, setSort] = useState<Sort>(() => {
    const saved = localStorage.getItem("orbit:dashboard:sort");
    return (saved as Sort) || "recent";
  });
  const [categoryFilter, setCategoryFilter] = useState<string | null>(() => {
    return localStorage.getItem("orbit:dashboard:categoryFilter") || null;
  });
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem("orbit:dashboard:filter", filter);
  }, [filter]);
  useEffect(() => {
    localStorage.setItem("orbit:dashboard:sort", sort);
  }, [sort]);
  useEffect(() => {
    if (categoryFilter) {
      localStorage.setItem("orbit:dashboard:categoryFilter", categoryFilter);
    } else {
      localStorage.removeItem("orbit:dashboard:categoryFilter");
    }
  }, [categoryFilter]);

  // Trigger background AI categorisation whenever tasks finish loading
  useEffect(() => {
    if (!api.loadingActive && api.activeTasks.length > 0) {
      void api.backgroundCategorize(api.activeTasks);
    }
  }, [api.activeTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (api.aiStatus && api.aiStatus.startsWith("Luna via ")) {
      return;
    }
    if (api.aiStatus) {
      toast.error(api.aiStatus, { id: "orbit-ai-status" });
    }
  }, [api.aiStatus]);

  // Re-fetch whenever the encryption key becomes available (covers the
  // fresh-sign-in case where the key isn't ready on initial mount).
  useEffect(() => {
    if (encryptionKey) {
      api.fetchActiveTasks();
      api.fetchArchivedTasks();
    }
  }, [encryptionKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
        !editTask &&
        !previewTask
      ) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCreate, createOpen, editTask, previewTask]);

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
    const openTasks = api.activeTasks.filter((t) => !t.completed);
    const completed = api.archivedTasks.filter((t) => t.completed).length;
    const total = openTasks.length + completed;
    const active = openTasks.length;
    const overdue = openTasks.filter(isOverdue).length;
    return { total, completed, active, overdue };
  }, [api.activeTasks, api.archivedTasks]);

  const progressPercent =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const displayed = useMemo(() => {
    let tasks = api.activeTasks.filter((t) => !t.completed);

    if (filter === "overdue") tasks = tasks.filter(isOverdue);

    if (categoryFilter) {
      tasks = tasks.filter((t) => api.categories[t.id] === categoryFilter);
    }

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
  }, [api.activeTasks, api.categories, filter, sort, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const task of api.activeTasks) {
      const cat = api.categories[task.id];
      if (cat) cats.add(cat);
    }
    return [...cats].sort();
  }, [api.activeTasks, api.categories]);

  // Clear category filter if the selected category no longer exists
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (categoryFilter && !uniqueCategories.includes(categoryFilter)) {
      setCategoryFilter(null);
    }
  }, [uniqueCategories, categoryFilter]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleCreate = async (
    data: Parameters<typeof api.createTask>[0],
    subTasks: SubTaskInput[],
  ) => {
    const taskId = await api.createTask(data);
    if (taskId) {
      if (subTasks.length > 0) {
        await api.saveSubTasks(taskId, subTasks, []);
      }
      toast.success("Task created");
    } else {
      toast.error("Failed to create task");
    }
    return !!taskId;
  };

  const handleSave = async (
    id: string,
    data: Parameters<typeof api.updateTask>[1],
    subTasks: SubTaskInput[],
    existingSubTaskIds: string[],
  ) => {
    const ok = await api.updateTask(id, data);
    if (ok) {
      await api.saveSubTasks(id, subTasks, existingSubTaskIds);
      toast.success("Task updated");
    } else {
      toast.error("Failed to update task");
    }
    return ok;
  };

  const handleToggle = async (id: string, completed: boolean) => {
    const ok = await api.toggleComplete(id, completed);
    if (!ok) {
      toast.error("Failed to update task");
      return ok;
    }
    if (completed) {
      if (previewTask?.id === id) setPreviewTask(null);
      toast.success("Task completed and archived");
    }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8 sm:mb-10">
        <div className="animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {getGreeting()}
          </h1>
          <p className="text-sm text-white/35 mt-1.5">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-linear-to-r from-violet-500 to-blue-500 text-white text-sm font-semibold rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.97] transition-all duration-150 shadow-lg shadow-violet-500/20 focus-ring w-full sm:w-auto"
        >
          <Plus size={16} strokeWidth={2.5} />
          New task
          <kbd className="ml-1 text-[10px] font-medium text-white/50 bg-white/15 px-1.5 py-0.5 rounded hidden sm:inline">
            N
          </kbd>
        </button>
      </div>

      {/* Stats strip */}
      <div
        className="flex items-center gap-2.5 flex-wrap mb-7 animate-fade-in"
        style={{ animationDelay: "50ms" }}
      >
        <StatPill
          icon={<Circle size={12} />}
          value={stats.active}
          label="active"
          iconClass="text-blue-400/70"
        />
        <StatPill
          icon={<AlertCircle size={12} />}
          value={stats.overdue}
          label="overdue"
          iconClass={stats.overdue > 0 ? "text-red-400/80" : "text-white/20"}
          dim={stats.overdue === 0}
        />
        <StatPill
          icon={<CheckCircle2 size={12} />}
          value={stats.completed}
          label="done"
          iconClass="text-emerald-400/70"
        />
        {stats.total > 0 && (
          <div className="flex-1 min-w-25 flex items-center gap-2.5 ml-1">
            <div className="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-[11px] text-white/30 font-semibold tabular-nums shrink-0">
              {progressPercent}%
            </span>
          </div>
        )}
      </div>

      {/* Filter + sort bar */}
      <div
        className="relative z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-y-2 mb-4 sm:mb-5 animate-fade-in"
        style={{ animationDelay: "100ms" }}
      >
        <div
          className="flex items-center gap-1 bg-white/5 border border-white/7 rounded-xl p-1 overflow-x-auto no-scrollbar"
          role="tablist"
          aria-label="Task filters"
        >
          {(["active", "overdue"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              role="tab"
              aria-selected={filter === f}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all duration-200 focus-ring whitespace-nowrap ${
                filter === f
                  ? "bg-linear-to-r from-violet-500 to-blue-500 text-white shadow-sm shadow-violet-500/15"
                  : "text-white/35 hover:text-white/65 hover:bg-white/4"
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
                ? "text-white/75 bg-white/7"
                : "text-white/45 hover:text-white/75 hover:bg-white/5"
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

      {/* Category filter chips */}
      {(uniqueCategories.length > 0 || api.isCategorizingBackground) && (
        <div
          className="flex items-center gap-2 flex-wrap mb-4 animate-fade-in"
          style={{ animationDelay: "120ms" }}
        >
          <span className="flex items-center gap-1 text-[10px] text-white/25 font-semibold uppercase tracking-widest shrink-0">
            <Tag size={10} />
            Category
            {api.isCategorizingBackground && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-pulse" />
            )}
          </span>
          {uniqueCategories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setCategoryFilter(cat === categoryFilter ? null : cat)
              }
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 border ${
                categoryFilter === cat
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                  : "bg-white/4 text-white/40 border-white/8 hover:text-white/65 hover:bg-white/7 hover:border-white/15"
              }`}
            >
              {cat}
            </button>
          ))}
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter(null)}
              className="flex items-center gap-1 text-[11px] text-white/25 hover:text-white/50 transition-colors"
              aria-label="Clear category filter"
            >
              <X size={10} />
              Clear
            </button>
          )}
          {!api.isCategorizingBackground &&
            isFeatureReady("autoCategorize") &&
            api.activeTasks.some((t) => !api.categories[t.id]) && (
              <button
                onClick={() => void api.backgroundCategorize(api.activeTasks)}
                className="ml-auto flex items-center gap-1 text-[11px] text-white/25 hover:text-violet-400 transition-colors"
                title="Categorise remaining tasks"
              >
                <Sparkles size={11} />
                Categorise
              </button>
            )}
        </div>
      )}

      {api.aiStatus && !api.aiStatus.startsWith("Luna via ") && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2 text-xs text-amber-200/80">
          {api.aiStatus}
        </div>
      )}

      {/* Task list */}
      {api.loadingActive ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size={24} className="text-white/20" />
        </div>
      ) : displayed.length === 0 ? (
        <EmptyState
          filter={filter}
          category={categoryFilter}
          onNew={openCreate}
        />
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
                onPreview={setPreviewTask}
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
        fetchSubTasks={api.fetchSubTasks}
      />
      <TaskPreviewModal
        task={previewTask}
        onClose={() => setPreviewTask(null)}
        onEdit={(t) => {
          setPreviewTask(null);
          setEditTask(t);
        }}
        fetchSubTasks={api.fetchSubTasks}
        fetchSubTaskCount={api.fetchSubTaskCount}
        onToggleSubTask={api.toggleSubTaskComplete}
        onUpdateSubTask={api.updateSubTaskTitle}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StatPillProps {
  icon: React.ReactNode;
  value: number;
  label: string;
  iconClass: string;
  dim?: boolean;
}

function StatPill({ icon, value, label, iconClass, dim }: StatPillProps) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.035] border border-white/[0.07] rounded-xl transition-opacity duration-200 ${
        dim ? "opacity-40" : ""
      }`}
    >
      <span className={iconClass}>{icon}</span>
      <span className="text-sm font-bold text-white/80 tabular-nums leading-none">
        {value}
      </span>
      <span className="text-[10px] text-white/30 font-medium leading-none">
        {label}
      </span>
    </div>
  );
}

function EmptyState({
  filter,
  category,
  onNew,
}: {
  filter: Filter;
  category: string | null;
  onNew: () => void;
}) {
  if (category) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/7 flex items-center justify-center mb-5">
          <Tag size={20} className="text-white/15" />
        </div>
        <p className="text-white/35 text-sm font-medium">
          No tasks in &ldquo;{category}&rdquo;
        </p>
        <button
          onClick={onNew}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 border border-white/10 text-white/45 hover:text-white/75 hover:border-white/20 hover:bg-white/4 rounded-xl text-sm font-medium transition-all duration-200 focus-ring"
        >
          <Plus size={15} />
          New task
        </button>
      </div>
    );
  }
  const msgs: Record<Filter, string> = {
    active: "No active tasks right now.",
    overdue: "No overdue tasks — you're on track!",
  };
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/7 flex items-center justify-center mb-5 animate-float">
        {filter === "active" ? (
          <Sparkles size={22} className="text-violet-400/40" />
        ) : (
          <ListTodo size={22} className="text-white/15" />
        )}
      </div>
      <p className="text-white/35 text-sm font-medium">{msgs[filter]}</p>
      {filter === "active" && (
        <button
          onClick={onNew}
          className="mt-5 flex items-center gap-2 px-5 py-2.5 border border-white/10 text-white/45 hover:text-white/75 hover:border-white/20 hover:bg-white/4 rounded-xl text-sm font-medium transition-all duration-200 focus-ring"
        >
          <Plus size={15} />
          Create your first task
        </button>
      )}
    </div>
  );
}
