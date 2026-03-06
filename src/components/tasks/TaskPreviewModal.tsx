import { useRef, useState, useEffect } from "react";
import { format, isPast, isToday, isTomorrow, parseISO } from "date-fns";
import {
  Calendar,
  Flag,
  AlignLeft,
  Circle,
  CheckCircle2,
  Pencil,
  ListChecks,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { renderMarkdown } from "../../lib/markdown";
import type { Task, SubTask } from "../../types/database.types";

interface Props {
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
  fetchSubTasks: (taskId: string) => Promise<SubTask[]>;
  fetchSubTaskCount: (taskId: string) => Promise<number>;
  onToggleSubTask: (subTaskId: string, completed: boolean) => Promise<boolean>;
}

const PRIORITY_CONFIG = {
  low: {
    label: "Low",
    dot: "bg-blue-400/70",
    text: "text-blue-400",
    bg: "bg-blue-500/[0.08] border-blue-500/20",
  },
  medium: {
    label: "Medium",
    dot: "bg-amber-400/80",
    text: "text-amber-400",
    bg: "bg-amber-500/[0.08] border-amber-500/20",
  },
  high: {
    label: "High",
    dot: "bg-rose-400",
    text: "text-rose-400",
    bg: "bg-rose-500/[0.08] border-rose-500/20",
  },
};

function getDueDateInfo(due: string, completed: boolean) {
  const d = parseISO(due);
  const formatted = format(d, "EEEE, MMMM d, yyyy");
  if (completed) return { label: formatted, cls: "text-white/40" };
  if (isToday(d))
    return { label: `Today — ${formatted}`, cls: "text-amber-400" };
  if (isTomorrow(d))
    return { label: `Tomorrow — ${formatted}`, cls: "text-amber-300/75" };
  if (isPast(d))
    return { label: `Overdue — ${formatted}`, cls: "text-red-400" };
  return { label: formatted, cls: "text-white/55" };
}

export function TaskPreviewModal({
  task,
  onClose,
  onEdit,
  fetchSubTasks,
  fetchSubTaskCount,
  onToggleSubTask,
}: Props) {
  // Keep a snapshot of the last non-null task so content stays visible
  // during the Modal's exit animation (when task becomes null).
  const lastTask = useRef<Task | null>(null);
  if (task) lastTask.current = task;
  const t = lastTask.current;

  const [subTasks, setSubTasks] = useState<SubTask[]>([]);
  const [subTaskCount, setSubTaskCount] = useState(0);
  const [subTasksLoading, setSubTasksLoading] = useState(false);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const completingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  useEffect(() => {
    let cancelled = false;
    let fetchTimer: ReturnType<typeof setTimeout> | null = null;

    if (task) {
      // Set loading state synchronously so React commits the skeleton render
      // before we fire the fetches. Without setTimeout(0), React 18's automatic
      // batching collapses setSubTasksLoading(true) with the cache-resolved
      // .then() callbacks into a single render, bypassing the skeleton entirely.
      setSubTasksLoading(true);
      setSubTasks([]);
      setSubTaskCount(0);
      setCompletingIds(new Set());

      fetchTimer = setTimeout(() => {
        if (cancelled) return;
        fetchSubTaskCount(task.id).then((count) => {
          if (!cancelled) setSubTaskCount(count);
        });
        fetchSubTasks(task.id).then((data) => {
          if (cancelled) return;
          setSubTasks(data);
          setSubTaskCount(data.length);
          setSubTasksLoading(false);
        });
      }, 0);
    } else {
      setSubTasks([]);
      setSubTaskCount(0);
      setSubTasksLoading(false);
    }

    return () => {
      cancelled = true;
      if (fetchTimer !== null) clearTimeout(fetchTimer);
    };
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = completingTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const handleToggleSub = async (st: SubTask) => {
    const willComplete = !st.completed;
    if (willComplete) {
      setCompletingIds((prev) => new Set(prev).add(st.id));
      const existing = completingTimers.current.get(st.id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setCompletingIds((prev) => {
          const next = new Set(prev);
          next.delete(st.id);
          return next;
        });
        completingTimers.current.delete(st.id);
      }, 700);
      completingTimers.current.set(st.id, timer);
    }
    const ok = await onToggleSubTask(st.id, willComplete);
    if (ok) {
      setSubTasks((prev) =>
        prev.map((s) =>
          s.id === st.id ? { ...s, completed: willComplete } : s,
        ),
      );
    } else if (willComplete) {
      // Revert animation if API failed
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(st.id);
        return next;
      });
    }
  };

  const priority = t ? PRIORITY_CONFIG[t.priority] : null;
  const due = t?.due_date ? getDueDateInfo(t.due_date, t.completed) : null;
  // While loading, use the known count (from the quick count fetch) or fall back
  // to 3 placeholder rows so skeletons always appear immediately.
  const skeletonCount = subTasksLoading
    ? subTaskCount > 0
      ? subTaskCount
      : 3
    : subTaskCount;
  const skeletonWidths = Array.from({ length: skeletonCount }, (_, index) => {
    const widths = [58, 78, 44, 67, 52, 73];
    return widths[index % widths.length];
  });

  return (
    <Modal
      open={!!task}
      onClose={onClose}
      title="Task details"
      maxWidth="max-w-xl"
    >
      {t && priority && (
        <div className="space-y-5">
          {/* Title + status */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0">
              {t.completed ? (
                <CheckCircle2 size={20} className="text-emerald-400/60" />
              ) : (
                <Circle size={20} className="text-white/20" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={`text-lg font-semibold leading-snug ${
                  t.completed ? "line-through text-white/35" : "text-white"
                }`}
              >
                {t.title}
              </h3>
              <span
                className={`inline-block mt-1.5 text-[11px] font-medium ${
                  t.completed ? "text-emerald-400/60" : "text-white/30"
                }`}
              >
                {t.completed ? "Completed" : "Active"}
              </span>
            </div>
          </div>

          {/* Description */}
          {t.description && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-white/30">
                <AlignLeft size={12} />
                <span className="text-[10px] font-semibold uppercase tracking-widest">
                  Description
                </span>
              </div>
              <div className="bg-white/3 border border-white/6 rounded-xl px-4 py-3 text-sm text-white/70 leading-relaxed space-y-1.5">
                {renderMarkdown(t.description)}
              </div>
            </div>
          )}

          {/* Sub-tasks */}
          {(subTasksLoading || subTasks.length > 0) && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-white/30">
                <ListChecks size={12} />
                <span className="text-[10px] font-semibold uppercase tracking-widest">
                  Sub-tasks
                </span>
                {!subTasksLoading && (
                  <span className="text-[10px] text-white/20 ml-auto">
                    {subTasks.filter((s) => s.completed).length}/
                    {subTasks.length}
                  </span>
                )}
              </div>
              {/* Sub-task progress bar */}
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden mb-3">
                {subTasksLoading ? (
                  <div className="h-full w-2/5 bg-white/8 rounded-full animate-pulse" />
                ) : (
                  <div
                    className="h-full bg-linear-to-r from-violet-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{
                      width: `${subTasks.length > 0 ? Math.round((subTasks.filter((s) => s.completed).length / subTasks.length) * 100) : 0}%`,
                    }}
                  />
                )}
              </div>
              {subTasksLoading ? (
                <div className="space-y-1">
                  {skeletonWidths.map((w, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 px-3 py-2"
                    >
                      <div className="w-3.75 h-3.75 rounded-full bg-white/[0.07] animate-pulse shrink-0" />
                      <div
                        className="h-2.5 rounded-full bg-white/[0.07] animate-pulse"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {subTasks.map((st) => {
                    const isCompleting = completingIds.has(st.id);
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleToggleSub(st)}
                        role="checkbox"
                        aria-checked={st.completed}
                        aria-label={
                          st.completed
                            ? `Mark "${st.title}" as incomplete`
                            : `Mark "${st.title}" as complete`
                        }
                        className={[
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 group/sub relative",
                          isCompleting ? "animate-row-complete" : "",
                          st.completed
                            ? "hover:bg-white/2.5"
                            : "hover:bg-emerald-500/5",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <span
                          className={[
                            "shrink-0 transition-all duration-150",
                            isCompleting ? "animate-check-pop" : "",
                            st.completed
                              ? "text-emerald-400/60"
                              : "text-white/20 group-hover/sub:text-emerald-400/55",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {st.completed ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <Circle size={15} />
                          )}
                        </span>
                        <span
                          className={`text-sm flex-1 transition-colors duration-200 ${
                            st.completed
                              ? "line-through text-white/30"
                              : "text-white/70 group-hover/sub:text-white/85"
                          }`}
                        >
                          {st.title}
                        </span>
                        {/* Inline hover action hint */}
                        <span
                          className={`text-[10px] font-medium shrink-0 ml-1 opacity-0 group-hover/sub:opacity-100 transition-all duration-150 ${
                            st.completed
                              ? "text-white/25"
                              : "text-emerald-400/60"
                          }`}
                          aria-hidden="true"
                        >
                          {st.completed ? "Undo" : "Complete"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Priority */}
          <div>
            <div className="flex items-center gap-1.5 mb-2 text-white/30">
              <Flag size={12} />
              <span className="text-[10px] font-semibold uppercase tracking-widest">
                Priority
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border rounded-xl ${priority.bg} ${priority.text}`}
            >
              <span className={`w-2 h-2 rounded-full ${priority.dot}`} />
              {priority.label}
            </span>
          </div>

          {/* Due date */}
          {due && (
            <div>
              <div className="flex items-center gap-1.5 mb-2 text-white/30">
                <Calendar size={12} />
                <span className="text-[10px] font-semibold uppercase tracking-widest">
                  Due date
                </span>
              </div>
              <span className={`text-sm font-medium ${due.cls}`}>
                {due.label}
              </span>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-2 border-t border-white/6 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-[11px] text-white/20">
            <span>
              Created{" "}
              {format(parseISO(t.created_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
            <span>
              Updated{" "}
              {format(parseISO(t.updated_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-white/40 border border-white/8 rounded-xl hover:bg-white/4 hover:text-white/55 transition-all duration-200 focus-ring"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(t);
              }}
              className="flex-1 py-2.5 text-sm font-semibold bg-linear-to-r from-violet-500 to-blue-500 text-white rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/15 focus-ring"
            >
              <Pencil size={13} />
              Edit task
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
