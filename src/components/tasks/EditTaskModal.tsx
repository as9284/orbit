import { useState, useEffect, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import {
  validateTaskTitle,
  validateTaskDescription,
} from "../../lib/validations";
import {
  AlignLeft,
  Flag,
  Plus,
  X,
  ListChecks,
  Circle,
  CheckCircle2,
} from "lucide-react";
import { RichTextEditor } from "../ui/RichTextEditor";
import { DatePicker } from "../ui/DatePicker";
import type { Task, SubTask } from "../../types/database.types";
import type { CreateTaskData, SubTaskInput } from "../../hooks/useTasks";

interface Props {
  task: Task | null;
  onClose: () => void;
  onSave: (
    id: string,
    data: CreateTaskData,
    subTasks: SubTaskInput[],
    existingSubTaskIds: string[],
  ) => Promise<boolean>;
  fetchSubTasks: (taskId: string) => Promise<SubTask[]>;
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

export function EditTaskModal({ task, onClose, onSave, fetchSubTasks }: Props) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [desc, setDesc] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">(
    task?.priority ?? "medium",
  );
  const [dueDate, setDueDate] = useState(
    task?.due_date ? task.due_date.split("T")[0] : "",
  );
  const [subTasks, setSubTasks] = useState<SubTaskInput[]>([]);
  const [existingSubTaskIds, setExistingSubTaskIds] = useState<string[]>([]);
  const [newSubTask, setNewSubTask] = useState("");
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
      setNewSubTask("");
      // Load sub-tasks
      fetchSubTasks(task.id).then((sts) => {
        setSubTasks(
          sts.map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
          })),
        );
        setExistingSubTaskIds(sts.map((s) => s.id));
      });
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const addSubTask = () => {
    const text = newSubTask.trim();
    if (!text || text.length > 200) return;
    setSubTasks((prev) => [...prev, { title: text, completed: false }]);
    setNewSubTask("");
  };

  const removeSubTask = (index: number) => {
    setSubTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSubTask = (index: number) => {
    setSubTasks((prev) =>
      prev.map((st, i) =>
        i === index ? { ...st, completed: !st.completed } : st,
      ),
    );
  };

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
    const ok = await onSave(
      task.id,
      {
        title,
        description: desc || undefined,
        priority,
        due_date: dueDate || null,
      },
      subTasks,
      existingSubTaskIds,
    );
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
            className={`w-full bg-transparent text-white text-base font-medium placeholder:text-white/25 outline-none border-b pb-2.5 transition-colors duration-200 ${
              errors.title
                ? "border-red-500/40"
                : "border-white/9 focus:border-violet-500/40"
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
            {subTasks.length > 0 && (
              <span className="text-[10px] text-white/20 ml-auto">
                {subTasks.filter((s) => s.completed).length}/{subTasks.length}
              </span>
            )}
          </div>
          {subTasks.length > 0 && (
            <div className="space-y-1.5 mb-2.5">
              {subTasks.map((st, i) => (
                <div
                  key={st.id ?? `new-${i}`}
                  className="flex items-center gap-2 px-3 py-2 bg-white/4 border border-white/7 rounded-lg group"
                >
                  <button
                    type="button"
                    onClick={() => toggleSubTask(i)}
                    className={`shrink-0 transition-colors ${
                      st.completed
                        ? "text-emerald-400/60 hover:text-emerald-400/90"
                        : "text-white/20 hover:text-white/50"
                    }`}
                    aria-label={
                      st.completed ? "Mark incomplete" : "Mark complete"
                    }
                  >
                    {st.completed ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <Circle size={15} />
                    )}
                  </button>
                  <span
                    className={`flex-1 text-sm truncate ${
                      st.completed
                        ? "line-through text-white/30"
                        : "text-white/70"
                    }`}
                  >
                    {st.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSubTask(i)}
                    className="p-0.5 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
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
              className="flex-1 min-w-0 bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-violet-500/35 transition-colors"
            />
            <button
              type="button"
              onClick={addSubTask}
              disabled={!newSubTask.trim()}
              className="px-3 py-2 rounded-lg border border-white/8 text-white/40 hover:text-white/70 hover:bg-white/6 disabled:opacity-30 disabled:cursor-default transition-all"
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
            className="flex-1 py-2.5 text-sm font-medium text-white/40 border border-white/8 rounded-xl hover:bg-white/4 hover:text-white/55 transition-all duration-200 focus-ring"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold bg-linear-to-r from-violet-500 to-blue-500 text-white rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/15 focus-ring"
          >
            {loading && <Spinner size={13} className="text-white" />}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
