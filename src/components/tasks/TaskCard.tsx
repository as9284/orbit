import { useState } from "react";
import { format, isPast, isToday, parseISO, isTomorrow } from "date-fns";
import { Circle, CheckCircle2, Archive, Pencil, Calendar } from "lucide-react";
import type { Task } from "../../types/database.types";

interface Props {
  task: Task;
  onToggleComplete: (id: string, completed: boolean) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
  onEdit: (task: Task) => void;
}

const PRIORITY_STYLES = {
  low: {
    dot: "bg-blue-400/60",
    label: "text-blue-400/50",
    text: "Low",
    border: "border-l-blue-500/25",
  },
  medium: {
    dot: "bg-amber-400/70",
    label: "text-amber-400/50",
    text: "Medium",
    border: "border-l-amber-500/30",
  },
  high: {
    dot: "bg-rose-400",
    label: "text-rose-400/60",
    text: "High",
    border: "border-l-rose-500/40",
  },
};

function getDueDateDisplay(due: string, completed: boolean) {
  const d = parseISO(due);
  if (completed) return { label: format(d, "MMM d"), cls: "text-white/20" };
  if (isToday(d)) return { label: "Today", cls: "text-amber-400" };
  if (isTomorrow(d)) return { label: "Tomorrow", cls: "text-amber-300/70" };
  if (isPast(d)) return { label: format(d, "MMM d"), cls: "text-red-400" };
  return { label: format(d, "MMM d"), cls: "text-white/35" };
}

export function TaskCard({ task, onToggleComplete, onArchive, onEdit }: Props) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    await onToggleComplete(task.id, !task.completed);
    setToggling(false);
  };

  const priority = PRIORITY_STYLES[task.priority];
  const due = task.due_date
    ? getDueDateDisplay(task.due_date, task.completed)
    : null;

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3.5 rounded-xl border-l-2 border border-white/6 transition-all duration-200 ${priority.border} ${
        task.completed
          ? "bg-white/1 opacity-50"
          : "bg-white/2.5 hover:bg-white/4.5 hover:border-white/10 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20"
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`mt-0.5 shrink-0 transition-all duration-200 focus-ring rounded-full ${
          task.completed
            ? "text-emerald-400/50 hover:text-emerald-400/80"
            : "text-white/15 hover:text-white/55"
        }`}
        aria-label={task.completed ? "Mark as active" : "Mark as complete"}
      >
        {task.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </button>

      {/* Content */}
      <div
        className="flex-1 min-w-0 cursor-pointer select-none"
        onClick={() => onEdit(task)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onEdit(task);
          }
        }}
      >
        <p
          className={`text-sm font-medium leading-snug transition-all duration-200 ${
            task.completed ? "line-through text-white/25" : "text-white/90"
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 text-xs text-white/25 line-clamp-1 leading-relaxed">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span
            className={`flex items-center gap-1.5 text-[11px] ${priority.label}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${priority.dot}`} />
            {priority.text}
          </span>
          {due && (
            <span className={`flex items-center gap-1 text-[11px] ${due.cls}`}>
              <Calendar size={10} />
              {due.label}
            </span>
          )}
        </div>
      </div>

      {/* Hover actions */}
      <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 shrink-0">
        <button
          onClick={() => onEdit(task)}
          className="p-1.5 rounded-lg text-white/20 hover:text-white/70 hover:bg-white/6 transition-all duration-150 focus-ring"
          aria-label="Edit task"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onArchive(task.id)}
          className="p-1.5 rounded-lg text-white/20 hover:text-white/70 hover:bg-white/6 transition-all duration-150 focus-ring"
          aria-label="Archive task"
        >
          <Archive size={13} />
        </button>
      </div>
    </div>
  );
}
