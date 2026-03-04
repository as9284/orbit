import { useState, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import { DatePicker } from "../ui/DatePicker";
import {
  validateTaskTitle,
  validateTaskDescription,
} from "../../lib/validations";
import { AlignLeft, Flag, Plus, X, ListChecks } from "lucide-react";
import { RichTextEditor } from "../ui/RichTextEditor";
import type { CreateTaskData, SubTaskInput } from "../../hooks/useTasks";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (
    data: CreateTaskData,
    subTasks: SubTaskInput[],
  ) => Promise<boolean>;
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
    idle: "text-white/35 border-white/[0.08] hover:border-blue-500/25 hover:bg-blue-500/[0.04]",
    active:
      "text-blue-400 border-blue-500/35 bg-blue-500/[0.1] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]",
  },
  {
    value: "medium",
    label: "Medium",
    idle: "text-white/35 border-white/[0.08] hover:border-amber-500/25 hover:bg-amber-500/[0.04]",
    active:
      "text-amber-400 border-amber-500/35 bg-amber-500/[0.1] shadow-[inset_0_0_0_1px_rgba(245,158,11,0.12)]",
  },
  {
    value: "high",
    label: "High",
    idle: "text-white/35 border-white/[0.08] hover:border-rose-500/25 hover:bg-rose-500/[0.04]",
    active:
      "text-rose-400 border-rose-500/35 bg-rose-500/[0.1] shadow-[inset_0_0_0_1px_rgba(244,63,94,0.12)]",
  },
];

export function CreateTaskModal({ open, onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [subTasks, setSubTasks] = useState<SubTaskInput[]>([]);
  const [newSubTask, setNewSubTask] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    desc?: string;
    dueDate?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setTitle("");
    setDesc("");
    setPriority("medium");
    setDueDate("");
    setSubTasks([]);
    setNewSubTask("");
    setErrors({});
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addSubTask = () => {
    const text = newSubTask.trim();
    if (!text || text.length > 200) return;
    setSubTasks((prev) => [...prev, { title: text }]);
    setNewSubTask("");
  };

  const removeSubTask = (index: number) => {
    setSubTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {
      title: validateTaskTitle(title) ?? undefined,
      desc: validateTaskDescription(desc) ?? undefined,
    };
    if (dueDate && isNaN(new Date(dueDate).getTime())) {
      errs.dueDate = "Invalid date";
    }
    if (errs.title || errs.desc || errs.dueDate) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    const ok = await onCreate(
      {
        title,
        description: desc || undefined,
        priority,
        due_date: dueDate || null,
      },
      subTasks,
    );
    setLoading(false);
    if (ok) handleClose();
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <Modal open={open} onClose={handleClose} title="New task">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {/* Title */}
        <div>
          <input
            type="text"
            autoFocus
            placeholder="What needs to be done?"
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((p) => ({ ...p, title: undefined }));
            }}
            className={`w-full bg-transparent text-white text-base font-medium placeholder:text-white/25 outline-none border-b pb-2.5 transition-colors duration-200 ${
              errors.title
                ? "border-red-500/40"
                : "border-white/[0.09] focus:border-violet-500/40"
            }`}
          />
          {errors.title && (
            <p className="mt-1.5 text-[11px] text-red-400">{errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-white/30">
            <AlignLeft size={12} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Description
            </span>
          </div>
          <RichTextEditor
            value={desc}
            onChange={(v) => {
              setDesc(v);
              setErrors((p) => ({ ...p, desc: undefined }));
            }}
            maxLength={2000}
            hasError={!!errors.desc}
          />
          {errors.desc && (
            <p className="mt-1 text-[11px] text-red-400">{errors.desc}</p>
          )}
        </div>

        {/* Sub-tasks */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-white/30">
            <ListChecks size={12} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Sub-tasks
            </span>
          </div>
          {subTasks.length > 0 && (
            <div className="space-y-1.5 mb-2.5">
              {subTasks.map((st, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.07] rounded-lg group"
                >
                  <span className="flex-1 text-sm text-white/70 truncate">
                    {st.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubTask(i)}
                    className="p-0.5 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                    aria-label="Remove sub-task"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a sub-task…"
              value={newSubTask}
              maxLength={200}
              onChange={(e) => setNewSubTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSubTask();
                }
              }}
              className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-violet-500/35 transition-colors"
            />
            <button
              type="button"
              onClick={addSubTask}
              disabled={!newSubTask.trim()}
              className="px-3 py-2 rounded-lg border border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-default transition-all"
              aria-label="Add sub-task"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Priority */}
        <div>
          <div className="flex items-center gap-1.5 mb-2.5 text-white/30">
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
                className={`flex-1 py-2.5 text-xs font-semibold border rounded-xl transition-all duration-200 ${
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
          <div className="flex items-center gap-1.5 mb-2 text-white/30">
            <span className="text-[10px] font-semibold uppercase tracking-widest">
              Due date
            </span>
          </div>
          <DatePicker
            value={dueDate}
            onChange={(v) => {
              setDueDate(v);
              setErrors((p) => ({ ...p, dueDate: undefined }));
            }}
            min={today}
            placeholder="No due date"
            hasError={!!errors.dueDate}
          />
          {errors.dueDate && (
            <p className="mt-1 text-[11px] text-red-400">{errors.dueDate}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 text-sm font-medium text-white/40 border border-white/[0.08] rounded-xl hover:bg-white/[0.04] hover:text-white/55 transition-all duration-200 focus-ring"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold bg-linear-to-r from-violet-500 to-blue-500 text-white rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/15 focus-ring"
          >
            {loading && <Spinner size={13} className="text-white" />}
            Create task
          </button>
        </div>
      </form>
    </Modal>
  );
}
