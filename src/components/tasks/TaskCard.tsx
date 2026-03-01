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
    dot: "bg-white/20",
    label: "text-white/25",
    text: "Low",
  },
  medium: {
    dot: "bg-white/50",
    label: "text-white/40",
    text: "Medium",
  },
  high: {
    dot: "bg-white",
    label: "text-white/70",
    text: "High",
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
      className={`group flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all duration-150 ${
        task.completed
          ? "bg-white/[0.012] border-white/4 opacity-55"
          : "bg-white/2.5 border-white/6 hover:bg-white/4.5 hover:border-white/10"
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`mt-0.5 shrink-0 transition-all duration-150 ${
          task.completed ? "text-white/35" : "text-white/15 hover:text-white/55"
        }`}
        title={task.completed ? "Mark as active" : "Mark as complete"}
      >
        {task.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 select-none">
        <p
          className={`text-sm font-medium leading-snug ${
            task.completed ? "line-through text-white/30" : "text-white/90"
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 text-xs text-white/28 line-clamp-1 leading-relaxed">
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
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => onEdit(task)}
          className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/6 transition-colors"
          title="Edit task"
        >
          <Pencil size={13} />
        </button>
        <button
          onClick={() => onArchive(task.id)}
          className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/6 transition-colors"
          title="Archive task"
        >
          <Archive size={13} />
        </button>
      </div>
    </div>
  );
}
