import { useEffect, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  ArchiveRestore,
  Trash2,
  Archive,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useTasksApi } from "../components/layout/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "../components/ui/Spinner";
import type { Task } from "../types/database.types";

const PRIORITY_DOT: Record<string, string> = {
  low: "bg-blue-400",
  medium: "bg-amber-400",
  high: "bg-rose-400",
};

export function ArchivePage() {
  const api = useTasksApi();
  const { encryptionKey } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (encryptionKey) api.fetchArchivedTasks();
  }, [encryptionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnarchive = useCallback(
    async (id: string) => {
      const ok = await api.unarchiveTask(id);
      if (ok) toast.success("Task restored");
      else toast.error("Failed to restore task");
    },
    [api],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await api.deleteForever(id);
      if (ok) toast.success("Task permanently deleted");
      else toast.error("Failed to delete task");
      setConfirmDelete(null);
    },
    [api],
  );

  const handleClearAll = useCallback(async () => {
    const ids = api.archivedTasks.map((t) => t.id);
    for (const id of ids) {
      await api.deleteForever(id);
    }
    toast.success(
      `Cleared ${ids.length} archived task${ids.length !== 1 ? "s" : ""}`,
    );
  }, [api]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-fade-in">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Archive
          </h1>
          <p className="text-xs text-white/35 mt-1 tracking-wide">
            {api.archivedTasks.length} archived task
            {api.archivedTasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        {api.archivedTasks.length > 0 && (
          <button
            onClick={() => setConfirmDelete("__all__")}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-red-500/25 text-red-400/75 hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/[0.06] rounded-xl text-xs font-semibold transition-all duration-200 focus-ring"
          >
            <Trash2 size={13} />
            Clear all
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 p-3.5 mb-6 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs text-white/35">
        <Archive size={13} className="mt-0.5 shrink-0 text-violet-400/40" />
        Archived tasks are hidden from your dashboard. You can restore them or
        delete them permanently.
      </div>

      {/* List */}
      {api.loadingArchived ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={24} className="text-white/20" />
        </div>
      ) : api.archivedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-scale-in">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center mb-4 animate-float">
            <Archive size={20} className="text-white/25" />
          </div>
          <p className="text-white/30 text-sm">Archive is empty</p>
          <p className="text-white/18 text-xs mt-1">
            Archived tasks will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {api.archivedTasks.map((task, i) => (
            <div
              key={task.id}
              className="animate-slide-up"
              style={{
                animationDelay: `${Math.min(i * 40, 400) + 80}ms`,
                animationFillMode: "backwards",
              }}
            >
              <ArchivedTaskRow
                task={task}
                confirmingDelete={confirmDelete === task.id}
                onUnarchive={() => handleUnarchive(task.id)}
                onRequestDelete={() => setConfirmDelete(task.id)}
                onCancelDelete={() => setConfirmDelete(null)}
                onConfirmDelete={() => handleDelete(task.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Confirm clear-all dialog */}
      {confirmDelete === "__all__" && (
        <ConfirmDialog
          message={`Permanently delete all ${api.archivedTasks.length} archived tasks? This cannot be undone.`}
          onConfirm={handleClearAll}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ArchivedRowProps {
  task: Task;
  confirmingDelete: boolean;
  onUnarchive: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function ArchivedTaskRow({
  task,
  confirmingDelete,
  onUnarchive,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: ArchivedRowProps) {
  const borderColor =
    task.priority === "high"
      ? "border-l-rose-500"
      : task.priority === "medium"
        ? "border-l-amber-500"
        : "border-l-blue-500";

  return (
    <div
      className={`group flex flex-col sm:flex-row sm:items-start gap-3 px-4 py-3.5 rounded-xl border border-l-2 bg-white/[0.025] border-white/[0.06] hover:bg-white/[0.045] hover:border-white/[0.09] transition-all duration-200 ${borderColor}`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {/* Priority dot */}
        <div className="mt-1.5 shrink-0">
          <div
            className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium text-white/65 ${
              task.completed ? "line-through text-white/30" : ""
            }`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-0.5 text-xs text-white/30 line-clamp-1">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            {task.archived_at && (
              <span className="flex items-center gap-1 text-[10px] text-white/25">
                <Calendar size={9} />
                Archived {format(parseISO(task.archived_at), "MMM d")}
              </span>
            )}
            {task.completed && (
              <span className="text-[10px] text-emerald-400/55 font-medium">
                Completed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      {!confirmingDelete ? (
        <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 self-end sm:self-auto">
          <button
            onClick={onUnarchive}
            title="Restore task"
            aria-label="Restore task"
            className="p-2 sm:p-1.5 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-colors focus-ring"
          >
            <ArchiveRestore size={14} />
          </button>
          <button
            onClick={onRequestDelete}
            title="Delete permanently"
            aria-label="Delete permanently"
            className="p-2 sm:p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/[0.08] transition-colors focus-ring"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0 animate-fade-in self-end sm:self-auto">
          <p className="text-[11px] text-red-400/80 flex items-center gap-1">
            <AlertTriangle size={11} />
            Delete?
          </p>
          <button
            onClick={onConfirmDelete}
            className="px-2.5 py-1 text-[11px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors focus-ring"
          >
            Delete
          </button>
          <button
            onClick={onCancelDelete}
            className="px-2.5 py-1 text-[11px] text-white/35 hover:text-white/60 rounded-lg transition-colors focus-ring"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      onClick={onCancel}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="absolute inset-0 bg-orbit-950/90" />
      <div
        className="relative w-full max-w-sm bg-orbit-800 border border-white/[0.09] rounded-2xl shadow-2xl p-6 space-y-4 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div>
            <h3
              id="confirm-title"
              className="text-sm font-semibold text-white mb-1"
            >
              Confirm deletion
            </h3>
            <p className="text-xs text-white/45 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-white/45 border border-white/[0.08] rounded-xl hover:bg-white/[0.04] transition-colors focus-ring"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className="flex-1 py-2.5 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-500/90 active:scale-[0.98] transition-all focus-ring"
          >
            Delete all
          </button>
        </div>
      </div>
    </div>
  );
}
