import { useEffect, useState } from "react";
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
import { Spinner } from "../components/ui/Spinner";
import type { Task } from "../types/database.types";

const PRIORITY_DOT = {
  low: "bg-white/20",
  medium: "bg-white/50",
  high: "bg-white/90",
};

export function ArchivePage() {
  const api = useTasksApi();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    api.fetchArchivedTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUnarchive = async (id: string) => {
    const ok = await api.unarchiveTask(id);
    if (ok) toast.success("Task restored");
    else toast.error("Failed to restore task");
  };

  const handleDelete = async (id: string) => {
    const ok = await api.deleteForever(id);
    if (ok) toast.success("Task permanently deleted");
    else toast.error("Failed to delete task");
    setConfirmDelete(null);
  };

  const handleClearAll = async () => {
    const ids = api.archivedTasks.map((t) => t.id);
    for (const id of ids) {
      await api.deleteForever(id);
    }
    toast.success(
      `Cleared ${ids.length} archived task${ids.length !== 1 ? "s" : ""}`,
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Archive
          </h1>
          <p className="text-xs text-white/30 mt-0.5 tracking-wide">
            {api.archivedTasks.length} archived task
            {api.archivedTasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        {api.archivedTasks.length > 0 && (
          <button
            onClick={() => setConfirmDelete("__all__")}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 rounded-xl text-xs font-semibold transition-colors"
          >
            <Trash2 size={13} />
            Clear all
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2.5 p-3.5 mb-6 bg-white/2 border border-white/5 rounded-xl text-xs text-white/30">
        <Archive size={13} className="mt-0.5 shrink-0" />
        Archived tasks are hidden from your dashboard. You can restore them or
        delete them permanently.
      </div>

      {/* List */}
      {api.loadingArchived ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size={24} className="text-white/20" />
        </div>
      ) : api.archivedTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/4 border border-white/6 flex items-center justify-center mb-4">
            <Archive size={20} className="text-white/20" />
          </div>
          <p className="text-white/25 text-sm">Archive is empty</p>
        </div>
      ) : (
        <div className="space-y-2">
          {api.archivedTasks.map((task) => (
            <ArchivedTaskRow
              key={task.id}
              task={task}
              confirmingDelete={confirmDelete === task.id}
              onUnarchive={() => handleUnarchive(task.id)}
              onRequestDelete={() => setConfirmDelete(task.id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onConfirmDelete={() => handleDelete(task.id)}
            />
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
  return (
    <div className="group flex items-start gap-3 px-4 py-3.5 rounded-xl border bg-white/2 border-white/5 hover:bg-white/3.5 hover:border-white/8 transition-all">
      {/* Priority dot */}
      <div className="mt-1.5 shrink-0">
        <div
          className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium text-white/60 ${
            task.completed ? "line-through text-white/25" : ""
          }`}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="mt-0.5 text-xs text-white/25 line-clamp-1">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5">
          {task.archived_at && (
            <span className="flex items-center gap-1 text-[10px] text-white/20">
              <Calendar size={9} />
              Archived {format(parseISO(task.archived_at), "MMM d")}
            </span>
          )}
          {task.completed && (
            <span className="text-[10px] text-emerald-500/50 font-medium">
              Completed
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {!confirmingDelete ? (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={onUnarchive}
            title="Restore task"
            className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/6 transition-colors"
          >
            <ArchiveRestore size={13} />
          </button>
          <button
            onClick={onRequestDelete}
            title="Delete permanently"
            className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/8 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <p className="text-[11px] text-red-400/80 flex items-center gap-1">
            <AlertTriangle size={11} />
            Delete forever?
          </p>
          <button
            onClick={onConfirmDelete}
            className="px-2.5 py-1 text-[11px] font-semibold bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            Delete
          </button>
          <button
            onClick={onCancelDelete}
            className="px-2.5 py-1 text-[11px] text-white/35 hover:text-white/60 rounded-lg transition-colors"
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-orbit-950/85 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-orbit-800 border border-white/8 rounded-2xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle size={16} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">
              Confirm deletion
            </h3>
            <p className="text-xs text-white/40 leading-relaxed">{message}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium text-white/40 border border-white/7 rounded-xl hover:bg-white/3 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-500/90 transition-colors"
          >
            Delete all
          </button>
        </div>
      </div>
    </div>
  );
}
