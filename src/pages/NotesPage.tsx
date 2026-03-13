import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  FileText,
  Pencil,
  Trash2,
  StickyNote,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNotesApi, useTasksApi } from "../components/layout/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "../components/ui/Spinner";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { CreateNoteModal } from "../components/notes/CreateNoteModal";
import { EditNoteModal } from "../components/notes/EditNoteModal";
import { NotePreviewModal } from "../components/notes/NotePreviewModal";
import { NoteSummaryModal } from "../components/notes/NoteSummaryModal";
import { stripMarkdown } from "../lib/markdown";
import { isFeatureReady } from "../lib/ai";
import {
  convertNoteToTaskDraft,
  summarizeNote,
  type AiNoteSummary,
} from "../lib/openrouter";
import type { Note } from "../types/database.types";

export function NotesPage() {
  const api = useNotesApi();
  const tasksApi = useTasksApi();
  const { encryptionKey } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [previewNote, setPreviewNote] = useState<Note | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [convertingNoteId, setConvertingNoteId] = useState<string | null>(null);
  const [summarizingNoteId, setSummarizingNoteId] = useState<string | null>(
    null,
  );
  const [postConvertNote, setPostConvertNote] = useState<Note | null>(null);
  const [summaryNote, setSummaryNote] = useState<Note | null>(null);
  const [activeSummary, setActiveSummary] = useState<AiNoteSummary | null>(
    null,
  );

  // Re-render when AI settings change so feature checks update immediately
  const [, setAiTick] = useState(0);
  useEffect(() => {
    const handler = () => setAiTick((t) => t + 1);
    window.addEventListener("orbit:ai:changed", handler);
    return () => window.removeEventListener("orbit:ai:changed", handler);
  }, []);

  useEffect(() => {
    if (encryptionKey) api.fetchNotes();
  }, [encryptionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Background-categorize notes after they load
  useEffect(() => {
    if (api.notes.length > 0) {
      void api.backgroundCategorize(api.notes);
    }
  }, [api.notes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcut: N to create new note
  const openCreate = useCallback(() => setCreateOpen(true), []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "n" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !createOpen &&
        !editNote &&
        !previewNote
      ) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        e.preventDefault();
        openCreate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openCreate, createOpen, editNote, previewNote]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const note of api.notes) {
      const cat = api.categories[note.id];
      if (cat) cats.add(cat);
    }
    return [...cats].sort();
  }, [api.notes, api.categories]);

  const filtered = useMemo(() => {
    let result = search.trim()
      ? api.notes.filter(
          (n) =>
            n.title.toLowerCase().includes(search.toLowerCase()) ||
            n.content?.toLowerCase().includes(search.toLowerCase()),
        )
      : api.notes;
    if (categoryFilter) {
      result = result.filter((n) => api.categories[n.id] === categoryFilter);
    }
    return result;
  }, [api.notes, api.categories, search, categoryFilter]);

  const handleCreate = async (title: string, content: string) => {
    const id = await api.createNote({
      title,
      content: content || undefined,
    });
    if (id) toast.success("Note created");
    else toast.error("Failed to create note");
    return !!id;
  };

  const handleSave = async (id: string, title: string, content: string) => {
    const ok = await api.updateNote(id, {
      title,
      content: content || undefined,
    });
    if (ok) toast.success("Note updated");
    else toast.error("Failed to update note");
    return ok;
  };

  const handleDelete = useCallback(
    async (id: string) => {
      const ok = await api.deleteNote(id);
      if (ok) toast.success("Note deleted");
      else toast.error("Failed to delete note");
      setDeleteId(null);
    },
    [api],
  );

  const closePreview = useCallback(() => {
    setPreviewNote(null);
    setSummaryNote(null);
    setActiveSummary(null);
  }, []);

  const handleConvertToTask = useCallback(
    async (note: Note) => {
      if (!isFeatureReady("noteTools")) {
        toast.error("Enable Note AI features in Settings → Luna first");
        return;
      }

      setConvertingNoteId(note.id);
      try {
        const result = await convertNoteToTaskDraft(note.title, note.content);

        if (!result.draft) {
          toast.error(result.error || "Luna couldn't convert this note");
          return;
        }

        const taskId = await tasksApi.createTask({
          title: result.draft.title,
          description: result.draft.description || undefined,
          priority: result.draft.priority,
        });

        if (!taskId) {
          toast.error("Task creation failed after Luna conversion");
          return;
        }

        if (result.draft.subTasks.length > 0) {
          const saved = await tasksApi.saveSubTasks(
            taskId,
            result.draft.subTasks.map((title) => ({ title })),
            [],
          );
          if (!saved) {
            toast.error("Task created, but sub-tasks could not be saved");
            return;
          }
        }

        const categoryResult = await tasksApi.categorizeSingleTask({
          taskId,
          title: result.draft.title,
          description: result.draft.description,
        });

        if (categoryResult.error) {
          toast.error(
            `Task created, but categorization failed: ${categoryResult.error}`,
          );
        }

        toast.success(
          categoryResult.category
            ? `Task created with Luna in ${categoryResult.category}`
            : result.model
              ? `Task created with Luna via ${result.model}`
              : "Task created with Luna",
        );
        setPostConvertNote(note);
      } finally {
        setConvertingNoteId(null);
      }
    },
    [tasksApi],
  );

  const handleSummarizeNote = useCallback(async (note: Note) => {
    if (!isFeatureReady("noteTools")) {
      toast.error("Enable Note AI features in Settings → Luna first");
      return;
    }

    setSummarizingNoteId(note.id);
    try {
      const result = await summarizeNote(note.title, note.content);

      if (!result.summary) {
        toast.error(result.error || "Luna couldn't summarize this note");
        return;
      }

      setSummaryNote(note);
      setActiveSummary(result.summary);

      toast.success(
        result.model
          ? `Summary ready via ${result.model}`
          : "Summary ready with Luna",
      );
    } finally {
      setSummarizingNoteId(null);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-6 sm:py-10 animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8 sm:mb-10">
        <div className="animate-slide-up">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Notes
          </h1>
          <p className="text-sm text-white/35 mt-1.5">
            {api.notes.length} note{api.notes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-linear-to-r from-violet-500 to-blue-500 text-white text-sm font-semibold rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.97] transition-all duration-150 shadow-lg shadow-violet-500/20 focus-ring w-full sm:w-auto"
        >
          <Plus size={16} strokeWidth={2.5} />
          New note
          <kbd className="ml-1 text-[10px] font-medium text-white/50 bg-white/15 px-1.5 py-0.5 rounded hidden sm:inline">
            N
          </kbd>
        </button>
      </div>

      {/* Search */}
      {api.notes.length > 0 && (
        <div
          className="mb-4 animate-fade-in"
          style={{ animationDelay: "50ms" }}
        >
          <input
            type="text"
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white/4 border border-white/8 rounded-xl px-4 py-2.5 text-sm text-white/85 placeholder:text-white/25 outline-none focus:border-violet-500/35 transition-colors"
          />
        </div>
      )}

      {/* Category filter chips */}
      {(uniqueCategories.length > 0 || api.isCategorizingBackground) && (
        <div
          className="flex items-center gap-2 flex-wrap mb-6 animate-fade-in"
          style={{ animationDelay: "80ms" }}
        >
          <span className="flex items-center gap-1 text-[10px] text-white/25 font-semibold uppercase tracking-widest shrink-0">
            <Tag size={10} />
            Category
            {api.isCategorizingBackground && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-pulse" />
            )}
          </span>
          {uniqueCategories.map((cat) => (
            <button
              key={cat}
              onClick={() =>
                setCategoryFilter(cat === categoryFilter ? null : cat)
              }
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-200 border ${
                categoryFilter === cat
                  ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                  : "bg-white/4 text-white/40 border-white/8 hover:text-white/65 hover:bg-white/7 hover:border-white/15"
              }`}
            >
              {cat}
            </button>
          ))}
          {categoryFilter && (
            <button
              onClick={() => setCategoryFilter(null)}
              className="flex items-center gap-1 text-[11px] text-white/25 hover:text-white/50 transition-colors"
              aria-label="Clear category filter"
            >
              <X size={10} />
              Clear
            </button>
          )}
          {!api.isCategorizingBackground &&
            isFeatureReady("autoCategorize") &&
            api.notes.some((n) => !api.categories[n.id]) && (
              <button
                onClick={() => void api.backgroundCategorize(api.notes)}
                className="ml-auto flex items-center gap-1 text-[11px] text-white/25 hover:text-violet-400 transition-colors"
                title="Categorise remaining notes"
              >
                <Sparkles size={11} />
                Categorise
              </button>
            )}
        </div>
      )}

      {api.aiStatus && !api.aiStatus.startsWith("Luna via ") && (
        <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/6 px-3 py-2 text-xs text-amber-200/80">
          {api.aiStatus}
        </div>
      )}

      {/* Notes grid */}
      {api.loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size={24} className="text-white/20" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/[0.07] flex items-center justify-center mb-5 animate-float">
            <StickyNote size={22} className="text-violet-400/40" />
          </div>
          <p className="text-white/35 text-sm font-medium">
            {search
              ? "No notes match your search"
              : "No notes yet. Create your first one."}
          </p>
          {!search && (
            <button
              onClick={openCreate}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 border border-white/10 text-white/45 hover:text-white/75 hover:border-white/20 hover:bg-white/4 rounded-xl text-sm font-medium transition-all duration-200 focus-ring"
            >
              <Plus size={15} />
              Create your first note
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((note, i) => (
            <div
              key={note.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(i * 40, 400) + 120}ms` }}
            >
              <NoteCard
                note={note}
                category={api.categories[note.id] ?? null}
                converting={convertingNoteId === note.id}
                onEdit={setEditNote}
                onPreview={setPreviewNote}
                onDelete={(id) => setDeleteId(id)}
                onConvert={handleConvertToTask}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateNoteModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      <EditNoteModal
        open={!!editNote}
        note={editNote}
        onClose={() => setEditNote(null)}
        onSave={handleSave}
      />
      <NotePreviewModal
        note={previewNote}
        converting={previewNote?.id === convertingNoteId}
        summarizing={previewNote?.id === summarizingNoteId}
        summaryOpen={!!summaryNote && !!activeSummary}
        onClose={closePreview}
        onEdit={(n) => {
          closePreview();
          setEditNote(n);
        }}
        onConvert={handleConvertToTask}
        onSummarize={handleSummarizeNote}
      />
      <NoteSummaryModal
        open={!!summaryNote && !!activeSummary}
        note={summaryNote}
        summary={activeSummary}
        onClose={() => {
          setSummaryNote(null);
          setActiveSummary(null);
        }}
      />
      <ConfirmModal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete note"
        message="Permanently delete this note? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => deleteId && handleDelete(deleteId)}
      />
      <ConfirmModal
        open={!!postConvertNote}
        onClose={() => setPostConvertNote(null)}
        title="Delete original note?"
        message="The task was created successfully. Delete the original note now, or keep it for reference? Note archiving is not available yet."
        confirmLabel="Delete note"
        onConfirm={() => {
          if (!postConvertNote) return;
          if (previewNote?.id === postConvertNote.id) {
            setPreviewNote(null);
          }
          void handleDelete(postConvertNote.id);
          setPostConvertNote(null);
        }}
      />
    </div>
  );
}

// ─── Note Card ────────────────────────────────────────────────────────────────

function NoteCard({
  note,
  category,
  converting,
  onEdit,
  onPreview,
  onDelete,
  onConvert,
}: {
  note: Note;
  category: string | null;
  converting: boolean;
  onEdit: (note: Note) => void;
  onPreview: (note: Note) => void;
  onDelete: (id: string) => void;
  onConvert: (note: Note) => void;
}) {
  return (
    <div
      className="group relative bg-white/3 border border-white/[0.07] rounded-2xl p-4 hover:bg-white/5.5 hover:border-white/11 hover:-translate-y-px hover:shadow-lg hover:shadow-black/20 transition-all duration-200 cursor-pointer"
      onClick={() => onPreview(note)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPreview(note);
        }
      }}
    >
      <div className="flex items-start gap-3 mb-2">
        <FileText size={14} className="text-violet-400/50 shrink-0 mt-0.5" />
        <h3 className="text-sm font-semibold text-white/90 line-clamp-1 flex-1">
          {note.title}
        </h3>
      </div>
      {note.content && (
        <p className="text-xs text-white/30 line-clamp-3 leading-relaxed mb-3 ml-6.5">
          {stripMarkdown(note.content)}
        </p>
      )}
      <div className="flex items-center justify-between ml-6.5">
        <span className="text-[10px] text-white/20">
          {format(parseISO(note.updated_at), "MMM d, yyyy")}
        </span>
        <div className="flex items-center gap-1.5">
          {category && (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-violet-500/12 text-violet-300/70 border border-violet-400/15">
              {category}
            </span>
          )}
          <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConvert(note);
              }}
              disabled={converting}
              className="p-1.5 rounded-lg text-cyan-300/45 hover:text-cyan-200 hover:bg-cyan-500/10 transition-all disabled:opacity-60 disabled:cursor-wait"
              aria-label="Convert note to task with Luna"
            >
              {converting ? <Spinner size={12} /> : <Sparkles size={12} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
              }}
              className="p-1.5 rounded-lg text-white/25 hover:text-white/70 hover:bg-white/[0.07] transition-all"
              aria-label="Edit note"
            >
              <Pencil size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
              className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/8 transition-all"
              aria-label="Delete note"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
