import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import {
  validateTaskTitle,
  validateTaskDescription,
} from "../../lib/validations";
import { AlignLeft, Flag } from "lucide-react";
import { DatePicker } from "../ui/DatePicker";
import type { Task } from "../../types/database.types";
import type { CreateTaskData } from "../../hooks/useTasks";

interface Props {
  task: Task | null;
  onClose: () => void;
  onSave: (id: string, data: CreateTaskData) => Promise<boolean>;
}

const PRIORITIES: {
  value: "low" | "medium" | "high";
  label: string;
  idle: string;
  active: string;
}[] = [
  {
    value: "low",
    label: "Low",
    idle: "text-white/30 border-white/[0.07] hover:border-blue-500/20",
    active:
      "text-blue-400 border-blue-500/30 bg-blue-500/[0.08] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.1)]",
  },
  {
    value: "medium",
    label: "Medium",
    idle: "text-white/30 border-white/[0.07] hover:border-amber-500/20",
    active:
      "text-amber-400 border-amber-500/30 bg-amber-500/[0.08] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.1)]",
  },
  {
    value: "high",
    label: "High",
    idle: "text-white/30 border-white/[0.07] hover:border-rose-500/20",
    active:
      "text-rose-400 border-rose-500/30 bg-rose-500/[0.08] shadow-[inset_0_0_0_1px_rgba(244,63,94,0.1)]",
  },
];

export function EditTaskModal({ task, onClose, onSave }: Props) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [desc, setDesc] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(
    task?.priority ?? "medium",
  );
  const [dueDate, setDueDate] = useState(
    task?.due_date ? task.due_date.split("T")[0] : "",
  );
  const [errors, setErrors] = useState<{ title?: string; desc?: string }>({});
  const [loading, setLoading] = useState(false);

  // Sync form state whenever a different task is opened
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDesc(task.description ?? "");
      setPriority(task.priority);
      setDueDate(task.due_date ? task.due_date.split("T")[0] : "");
      setErrors({});
      setLoading(false);
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!task) return;
    const errs: typeof errors = {
      title: validateTaskTitle(title) ?? undefined,
      desc: validateTaskDescription(desc) ?? undefined,
    };
    if (errs.title || errs.desc) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    const ok = await onSave(task.id, {
      title,
      description: desc || undefined,
      priority,
      due_date: dueDate || null,
    });
    setLoading(false);
    if (ok) onClose();
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <Modal open={!!task} onClose={onClose} title="Edit task">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Title */}
        <div>
          <input
            type="text"
            autoFocus
            placeholder="Task title"
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((p) => ({ ...p, title: undefined }));
            }}
            className={`w-full bg-transparent text-white text-base font-medium placeholder:text-white/20 outline-none border-b pb-2.5 transition-colors duration-200 ${
              errors.title
                ? "border-red-500/40"
                : "border-white/8 focus:border-violet-500/40"
            }`}
          />
          {errors.title && (
            <p className="mt-1.5 text-[11px] text-red-400">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-white/25">
            <AlignLeft size={12} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Description
            </span>
          </div>
          <textarea
            placeholder="Add a description (optional)"
            value={desc}
            maxLength={2000}
            rows={3}
            onChange={(e) => {
              setDesc(e.target.value);
              setErrors((p) => ({ ...p, desc: undefined }));
            }}
            className="w-full bg-white/3 border border-white/[0.07] rounded-xl px-3.5 py-2.5 text-white/80 text-sm placeholder:text-white/20 outline-none focus:border-violet-500/30 focus:bg-white/5 transition-all duration-200 resize-none"
          />
          {errors.desc && (
            <p className="mt-1 text-[11px] text-red-400">{errors.desc}</p>
          )}
        </div>

        {/* Priority */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5 text-white/25">
            <Flag size={12} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Priority
            </span>
          </div>
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={`flex-1 py-2 text-xs font-semibold border rounded-xl transition-all duration-200 ${
                  priority === p.value ? p.active : p.idle
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Due date */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-white/25">
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Due date
            </span>
          </div>
          <DatePicker
            value={dueDate}
            onChange={setDueDate}
            min={today}
            placeholder="No due date"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-white/35 border border-white/[0.07] rounded-xl hover:bg-white/3 hover:text-white/50 transition-all duration-200 focus-ring"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold bg-white text-orbit-950 rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 focus-ring"
          >
            {loading && <Spinner size={13} className="text-orbit-950" />}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
