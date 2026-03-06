import { useState, useEffect, useRef, type FormEvent } from "react";
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
  GripVertical,
} from "lucide-react";
import { RichTextEditor } from "../ui/RichTextEditor";
import { DatePicker } from "../ui/DatePicker";
import type { Task, SubTask } from "../../types/database.types";
import type { CreateTaskData, SubTaskInput } from "../../hooks/useTasks";

// Local subtask type with a stable local id for drag/animation tracking
type LocalSubTask = SubTaskInput & { _lid: string };

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
  const [subTasks, setSubTasks] = useState<LocalSubTask[]>([]);
  const [existingSubTaskIds, setExistingSubTaskIds] = useState<string[]>([]);
  const [newSubTask, setNewSubTask] = useState("");
  const [errors, setErrors] = useState<{ title?: string; desc?: string }>({});
  const [loading, setLoading] = useState(false);

  // Drag state
  const [dragLid, setDragLid] = useState<string | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{
    lid: string;
    insertBefore: boolean;
  } | null>(null);

  // Completion animation state
  const [completingLids, setCompletingLids] = useState<Set<string>>(new Set());
  const completingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Sync form state whenever a different task is opened
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDesc(task.description ?? "");
      setPriority(task.priority);
      setDueDate(task.due_date ? task.due_date.split("T")[0] : "");
      setErrors({});
      setLoading(false);
      setNewSubTask("");
      setDragLid(null);
      setDragOverInfo(null);
      setCompletingLids(new Set());
      fetchSubTasks(task.id).then((sts) => {
        setSubTasks(
          sts.map((s) => ({
            id: s.id,
            title: s.title,
            completed: s.completed,
            _lid: s.id,
          })),
        );
        setExistingSubTaskIds(sts.map((s) => s.id));
      });
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Cleanup animation timers on unmount
  useEffect(() => {
    const timers = completingTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const addSubTask = () => {
    const text = newSubTask.trim();
    if (!text || text.length > 200) return;
    setSubTasks((prev) => [
      ...prev,
      { title: text, completed: false, _lid: crypto.randomUUID() },
    ]);
    setNewSubTask("");
  };

  const removeSubTask = (lid: string) => {
    setSubTasks((prev) => prev.filter((s) => s._lid !== lid));
  };

  const toggleSubTask = (lid: string) => {
    const st = subTasks.find((s) => s._lid === lid);
    if (!st) return;
    const willComplete = !st.completed;
    setSubTasks((prev) =>
      prev.map((s) => (s._lid === lid ? { ...s, completed: willComplete } : s)),
    );
    if (willComplete) {
      setCompletingLids((prev) => new Set(prev).add(lid));
      const existing = completingTimers.current.get(lid);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        setCompletingLids((prev) => {
          const next = new Set(prev);
          next.delete(lid);
          return next;
        });
        completingTimers.current.delete(lid);
      }, 700);
      completingTimers.current.set(lid, timer);
    }
  };

  // ── Drag handlers ─────────────────────────────────────────────────

  const handleDragStart = (lid: string, e: React.DragEvent) => {
    setDragLid(lid);
    e.dataTransfer.effectAllowed = "move";
    // Transparent ghost so the row provides its own visual feedback
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
    // Strip _lid before passing to hook
    const ok = await onSave(
      task.id,
      {
        title,
        description: desc || undefined,
        priority,
        due_date: dueDate || null,
      },
      subTasks.map(({ _lid: _l, ...rest }) => rest), // eslint-disable-line @typescript-eslint/no-unused-vars
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
                {subTasks.length > 1 && (
                  <span className="ml-1.5 text-white/12">
                    {" "}
                    · drag to reorder
                  </span>
                )}
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
                const isCompleting = completingLids.has(st._lid);

                return (
                  <div key={st._lid} className="relative">
                    {/* Drop indicator — before */}
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
                        "flex items-start gap-2 px-3 py-2 border rounded-lg group select-none transition-all duration-150",
                        isDragging
                          ? "opacity-40 scale-[0.97] bg-white/2 border-white/5 cursor-grabbing"
                          : "bg-white/4 border-white/7 cursor-default",
                        isCompleting ? "animate-row-complete" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {/* Drag handle */}
                      <div
                        className="text-white/15 hover:text-white/45 transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none -ml-0.5"
                        title="Drag to reorder"
                        aria-hidden="true"
                      >
                        <GripVertical size={13} />
                      </div>

                      {/* Toggle button with tooltip */}
                      <div className="relative group/toggle shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleSubTask(st._lid)}
                          className={[
                            "transition-all duration-150 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
                            st.completed
                              ? "text-emerald-400/65 hover:text-emerald-400/95 hover:scale-110"
                              : "text-white/20 hover:text-emerald-400/70 hover:scale-110",
                            isCompleting ? "animate-check-pop" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          aria-label={
                            st.completed
                              ? `Mark "${st.title}" as incomplete`
                              : `Mark "${st.title}" as complete`
                          }
                          aria-pressed={st.completed}
                        >
                          {st.completed ? (
                            <CheckCircle2 size={15} />
                          ) : (
                            <Circle size={15} />
                          )}
                        </button>
                        {/* Hover tooltip */}
                        <span
                          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-[10px] font-medium bg-black/85 text-white/75 rounded-md whitespace-nowrap opacity-0 group-hover/toggle:opacity-100 pointer-events-none transition-opacity duration-150 z-20"
                          aria-hidden="true"
                        >
                          {st.completed ? "Mark incomplete" : "Mark complete"}
                        </span>
                      </div>

                      <span
                        className={`flex-1 min-w-0 text-sm break-words transition-all duration-200 ${
                          st.completed
                            ? "line-through text-white/25"
                            : "text-white/70"
                        }`}
                      >
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

                    {/* Drop indicator — after */}
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
