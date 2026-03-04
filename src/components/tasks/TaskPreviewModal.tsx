import { useRef } from "react";
import { format, isPast, isToday, isTomorrow, parseISO } from "date-fns";
import {
  Calendar,
  Flag,
  AlignLeft,
  Circle,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { Modal } from "../ui/Modal";
import { renderMarkdown } from "../../lib/markdown";
import type { Task } from "../../types/database.types";

interface Props {
  task: Task | null;
  onClose: () => void;
  onEdit: (task: Task) => void;
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

export function TaskPreviewModal({ task, onClose, onEdit }: Props) {
  // Keep a snapshot of the last non-null task so content stays visible
  // during the Modal's exit animation (when task becomes null).
  const lastTask = useRef<Task | null>(null);
  if (task) lastTask.current = task;
  const t = lastTask.current;

  const priority = t ? PRIORITY_CONFIG[t.priority] : null;
  const due = t?.due_date ? getDueDateInfo(t.due_date, t.completed) : null;

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
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/70 leading-relaxed space-y-1.5">
                {renderMarkdown(t.description)}
              </div>
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
          <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-[11px] text-white/20">
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
              className="flex-1 py-2.5 text-sm font-medium text-white/40 border border-white/[0.08] rounded-xl hover:bg-white/[0.04] hover:text-white/55 transition-all duration-200 focus-ring"
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
