import { useState, type FormEvent } from "react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import { DatePicker } from "../ui/DatePicker";
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
  GripVertical,
} from "lucide-react";
import { RichTextEditor } from "../ui/RichTextEditor";
import type { CreateTaskData, SubTaskInput } from "../../hooks/useTasks";

// Local subtask with stable local id for drag tracking
type LocalSubTaskCreate = { title: string; _lid: string };

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
    idle: "text-white/35 border-white/8 hover:border-blue-500/25 hover:bg-blue-500/4",
    active:
      "text-blue-400 border-blue-500/35 bg-blue-500/10 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)]",
  },
  {
    value: "medium",
    label: "Medium",
    idle: "text-white/35 border-white/8 hover:border-amber-500/25 hover:bg-amber-500/4",
    active:
      "text-amber-400 border-amber-500/35 bg-amber-500/10 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.12)]",
  },
  {
    value: "high",
    label: "High",
    idle: "text-white/35 border-white/8 hover:border-rose-500/25 hover:bg-rose-500/4",
    active:
      "text-rose-400 border-rose-500/35 bg-rose-500/10 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.12)]",
  },
];

export function CreateTaskModal({ open, onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");
  const [subTasks, setSubTasks] = useState<LocalSubTaskCreate[]>([]);
  const [newSubTask, setNewSubTask] = useState("");
  const [errors, setErrors] = useState<{
    title?: string;
    desc?: string;
    dueDate?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // Drag state for subtask reordering
  const [dragLid, setDragLid] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{
    lid: string;
    insertBefore: boolean;
  } | null>(null);

  const reset = () => {
    setTitle("");
    setDesc("");
    setPriority("medium");
    setDueDate("");
    setSubTasks([]);
    setNewSubTask("");
    setErrors({});
    setDragLid(null);
    setDragOverInfo(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addSubTask = () => {
    const text = newSubTask.trim();
    if (!text || text.length > 200) return;
    setSubTasks((prev) => [
      ...prev,
      { title: text, _lid: crypto.randomUUID() },
    ]);
    setNewSubTask("");
  };

  const removeSubTask = (lid: string) => {
    setSubTasks((prev) => prev.filter((s) => s._lid !== lid));
  };

  const handleDragStart = (lid: string, e: React.DragEvent) => {
    setDragLid(lid);
    e.dataTransfer.effectAllowed = "move";
    const ghost = document.createElement("div");
    ghost.style.opacity = "0";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    requestAnimationFrame(() => document.body.removeChild(ghost));
  };

  const handleDragOver = (e: React.DragEvent, lid: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragLid === lid) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const insertBefore = e.clientY < rect.top + rect.height / 2;
    setDragOverInfo((prev) =>
      prev?.lid === lid && prev?.insertBefore === insertBefore
        ? prev
        : { lid, insertBefore },
    );
  };

  const handleDrop = (targetLid: string) => {
    if (!dragLid || dragLid === targetLid) {
      setDragLid(null);
      setDragOverInfo(null);
      return;
    }
    const insertBefore = dragOverInfo?.insertBefore ?? true;
    setSubTasks((prev) => {
      const items = [...prev];
      const fromIdx = items.findIndex((s) => s._lid === dragLid);
      if (fromIdx === -1) return items;
      const [item] = items.splice(fromIdx, 1);
      const toIdx = items.findIndex((s) => s._lid === targetLid);
      if (toIdx === -1) {
        items.push(item);
        return items;
      }
      items.splice(insertBefore ? toIdx : toIdx + 1, 0, item);
      return items;
    });
    setDragLid(null);
    setDragOverInfo(null);
  };

  const handleDragEnd = () => {
    setDragLid(null);
    setDragOverInfo(null);
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
      subTasks.map(({ _lid: _l, ...rest }) => rest),
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
            {subTasks.length > 1 && (
              <span className="text-[10px] text-white/15 ml-auto">
                drag to reorder
              </span>
            )}
          </div>
          {subTasks.length > 0 && (
            <div className="space-y-1.5 mb-2.5">
              {subTasks.map((st) => {
                const isDragging = dragLid === st._lid;
                const showBefore =
                  dragOverInfo?.lid === st._lid &&
                  dragOverInfo.insertBefore &&
                  dragLid !== st._lid;
                const showAfter =
                  dragOverInfo?.lid === st._lid &&
                  !dragOverInfo.insertBefore &&
                  dragLid !== st._lid;
                return (
                  <div key={st._lid} className="relative">
                    {showBefore && (
                      <div className="absolute -top-0.5 left-3 right-3 h-0.5 bg-violet-500/65 rounded-full z-10 animate-fade-in" />
                    )}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(st._lid, e)}
                      onDragOver={(e) => handleDragOver(e, st._lid)}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop(st._lid);
                      }}
                      onDragEnd={handleDragEnd}
                      className={[
                        "flex items-center gap-2 px-3 py-2 border rounded-lg group select-none transition-all duration-150",
                        isDragging
                          ? "opacity-40 scale-[0.97] bg-white/2 border-white/5 cursor-grabbing"
                          : "bg-white/4 border-white/7 cursor-default",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div
                        className="text-white/15 hover:text-white/40 transition-colors cursor-grab active:cursor-grabbing shrink-0 -ml-0.5"
                        title="Drag to reorder"
                        aria-hidden="true"
                      >
                        <GripVertical size={13} />
                      </div>
                      <span className="flex-1 text-sm text-white/70 truncate">
                        {st.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubTask(st._lid)}
                        className="p-0.5 rounded text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Remove "${st.title}"`}
                        title="Remove sub-task"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    {showAfter && (
                      <div className="absolute -bottom-0.5 left-3 right-3 h-0.5 bg-violet-500/65 rounded-full z-10 animate-fade-in" />
                    )}
                  </div>
                );
              })}
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
            Create task
          </button>
        </div>
      </form>
    </Modal>
  );
}
