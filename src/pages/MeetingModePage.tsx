import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "react-hot-toast";
import {
  AlertTriangle,
  History,
  ListTodo,
  LoaderCircle,
  Play,
  Plus,
  Sparkles,
  Square,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { useNotesApi, useTasksApi } from "../components/layout/AppLayout";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Modal } from "../components/ui/Modal";
import { useAuth } from "../contexts/AuthContext";
import {
  useMeetingSessions,
  type MeetingSession,
} from "../hooks/useMeetingSessions";
import { getAiSettings, hasApiKey } from "../lib/ai";
import {
  generateMeetingArtifacts,
  generateMeetingAgenda,
} from "../lib/openrouter";

const MEETING_ENDING_PREFIX = "orbit:meeting-ending";

function formatSessionDate(value: string): string {
  return format(parseISO(value), "MMM d, yyyy • h:mm a");
}

function getMeetingEndingKey(userId?: string): string {
  return `${MEETING_ENDING_PREFIX}:${userId ?? "_"}`;
}

export function MeetingModePage() {
  const { user } = useAuth();
  const notesApi = useNotesApi();
  const tasksApi = useTasksApi();
  const {
    activeSession,
    sessions,
    startSession,
    addEntry,
    endSession,
    deleteSession,
    discardActiveSession,
  } = useMeetingSessions(user?.id);

  const [meetingTitle, setMeetingTitle] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [ending, setEnding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [selectedHistorySessionId, setSelectedHistorySessionId] = useState<
    string | null
  >(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [noteComposerKey, setNoteComposerKey] = useState(0);

  const notesEndRef = useRef<HTMLDivElement>(null);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);
  const meetingEndingKey = getMeetingEndingKey(user?.id);

  // Re-render when AI settings change so gating updates immediately.
  const [, setAiTick] = useState(0);
  useEffect(() => {
    const handler = () => setAiTick((tick) => tick + 1);
    window.addEventListener("orbit:ai:changed", handler);
    return () => window.removeEventListener("orbit:ai:changed", handler);
  }, []);

  const aiSettings = getAiSettings();
  const meetingEnabled = aiSettings.features.meetingMode;
  const apiKeyReady = hasApiKey();
  const meetingReady = meetingEnabled && apiKeyReady;

  // Auto-scroll to newest note when entries change.
  useEffect(() => {
    notesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.entries.length]);

  // Focus textarea when a session becomes active.
  useEffect(() => {
    if (activeSession) noteInputRef.current?.focus();
  }, [activeSession]);

  useEffect(() => {
    const pendingSessionId = localStorage.getItem(meetingEndingKey);

    if (activeSession && pendingSessionId === activeSession.id) {
      setEnding(true);
      return;
    }

    if (!activeSession || pendingSessionId !== activeSession.id) {
      setEnding(false);
    }

    if (!activeSession && pendingSessionId) {
      localStorage.removeItem(meetingEndingKey);
    }
  }, [activeSession, meetingEndingKey]);

  const selectedHistorySession =
    sessions.find((session) => session.id === selectedHistorySessionId) ?? null;

  const handleStartMeeting = useCallback(async () => {
    if (activeSession) {
      toast.error("Finish or discard the current meeting first");
      return;
    }

    if (!meetingEnabled) {
      toast.error("Enable Meeting Mode in Settings → Luna first");
      return;
    }

    if (!apiKeyReady) {
      toast.error("Add an API key in Settings → Luna first");
      return;
    }

    if (!meetingTitle.trim()) {
      toast.error("Add a meeting title before starting");
      return;
    }

    const created = startSession(meetingTitle);
    if (!created) {
      toast.error("Meeting title is required");
      return;
    }

    setMeetingTitle("");
    setSelectedHistorySessionId(null);
    toast.success("Meeting started");

    // Generate and inject an agenda as the first entry (non-blocking)
    try {
      const agendaResult = await generateMeetingAgenda(meetingTitle);
      if (agendaResult.agenda) {
        addEntry(`📋 Suggested Agenda\n\n${agendaResult.agenda}`);
      }
    } catch {
      // Agenda is best-effort; silently ignore failures
    }
  }, [
    activeSession,
    apiKeyReady,
    meetingEnabled,
    meetingTitle,
    startSession,
    addEntry,
  ]);

  const handleAddEntry = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (!activeSession) return;

      const added = addEntry(noteInput);
      if (!added) return;

      if (noteInputRef.current) {
        noteInputRef.current.value = "";
      }

      setNoteInput("");
      setNoteComposerKey((current) => current + 1);

      requestAnimationFrame(() => {
        noteInputRef.current?.focus();
      });
    },
    [activeSession, addEntry, noteInput],
  );

  const handleEntryKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.nativeEvent.isComposing) return;

      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleAddEntry();
      }
    },
    [handleAddEntry],
  );

  const handleEndMeeting = useCallback(async () => {
    if (!activeSession) return;

    if (activeSession.entries.length === 0) {
      toast.error("Add at least one meeting note before ending the session");
      return;
    }

    if (!meetingEnabled) {
      toast.error(
        "Re-enable Meeting Mode in Settings → Luna to finish this session",
      );
      return;
    }

    if (!apiKeyReady) {
      toast.error("Add an API key in Settings → Luna to finish this session");
      return;
    }

    localStorage.setItem(meetingEndingKey, activeSession.id);
    setEnding(true);

    try {
      const result = await generateMeetingArtifacts(
        activeSession.title,
        activeSession.entries.map((entry) => entry.content),
      );

      if (!result.artifacts) {
        toast.error(result.error || "Luna could not finish this meeting");
        return;
      }

      const noteId = await notesApi.createNote({
        title: result.artifacts.note.title,
        content: result.artifacts.note.content,
      });
      if (!noteId) {
        toast.error("Meeting note could not be created");
        return;
      }

      const taskId = await tasksApi.createTask({
        title: result.artifacts.task.title,
        description: result.artifacts.task.description || undefined,
        priority: result.artifacts.task.priority,
      });

      if (!taskId) {
        await notesApi.deleteNote(noteId);
        toast.error("Meeting task could not be created");
        return;
      }

      if (result.artifacts.task.subTasks.length > 0) {
        const saved = await tasksApi.saveSubTasks(
          taskId,
          result.artifacts.task.subTasks.map((title) => ({ title })),
          [],
        );
        if (!saved) {
          toast.error(
            "Meeting ended, but some follow-up sub-tasks could not be saved",
          );
        }
      }

      endSession({
        createdAt: new Date().toISOString(),
        model: result.model,
        warning: result.error,
        note: {
          ...result.artifacts.note,
          noteId,
        },
        task: {
          ...result.artifacts.task,
          taskId,
        },
      });

      setSelectedHistorySessionId(activeSession.id);
      setHistoryModalOpen(true);
      toast.success(
        result.error
          ? "Meeting ended with a structured fallback"
          : result.model
            ? `Meeting ended via ${result.model}`
            : "Meeting ended",
      );
    } finally {
      localStorage.removeItem(meetingEndingKey);
      setEnding(false);
    }
  }, [
    activeSession,
    apiKeyReady,
    endSession,
    meetingEndingKey,
    meetingEnabled,
    notesApi,
    tasksApi,
  ]);

  const handleDeleteSession = useCallback(
    (sessionId: string) => {
      const deleted = deleteSession(sessionId);
      if (deleted) {
        const remainingSessions = sessions.filter(
          (session) => session.id !== sessionId,
        );
        setSelectedHistorySessionId((current) => {
          if (current !== sessionId) return current;
          return remainingSessions[0]?.id ?? null;
        });
      }
      setDeleteTarget(null);
      if (deleted) toast.success("Meeting session deleted");
    },
    [deleteSession, sessions],
  );

  const handleDiscardActive = useCallback(() => {
    const discarded = discardActiveSession();
    setDeleteTarget(null);
    if (discarded) {
      setNoteInput("");
      toast.success("Active meeting discarded");
    }
  }, [discardActiveSession]);

  const openHistoryModal = useCallback(() => {
    if (sessions.length > 0 && !selectedHistorySessionId) {
      setSelectedHistorySessionId(sessions[0].id);
    }
    setHistoryModalOpen(true);
  }, [selectedHistorySessionId, sessions]);

  return (
    <div className="flex flex-col h-dvh md:h-screen animate-fade-in">
      {/* Header — full width, matches Luna */}
      <header className="shrink-0 border-b border-white/6 px-4 pr-17 sm:px-6 sm:pr-6 h-18 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
          <Sparkles size={16} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white tracking-tight">
            Meeting Mode
          </h1>
          <p className="text-[10px] text-white/30">
            Capture notes, let Luna wrap up.
          </p>
        </div>
        <button
          type="button"
          onClick={openHistoryModal}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/30 hover:text-white/60 hover:bg-white/5 transition-all duration-200"
        >
          <History size={12} />
          History
          {sessions.length > 0 && (
            <span className="inline-flex min-w-4 items-center justify-center rounded-full bg-white/8 px-1 text-[10px] text-white/45">
              {sessions.length}
            </span>
          )}
        </button>
      </header>

      {/* Not-ready warning banner */}
      {!meetingReady && (
        <div className="shrink-0 border-b border-amber-400/12 bg-amber-400/5 px-4 sm:px-6 py-2.5 flex items-center gap-2.5 text-xs text-amber-100/75">
          <AlertTriangle size={12} className="shrink-0 text-amber-300/80" />
          <span>
            <span className="font-medium text-amber-100/90">
              Meeting Mode not ready —{" "}
            </span>
            {!meetingEnabled
              ? "enable it in Settings → Luna."
              : "add an API key in Settings → Luna."}
          </span>
        </div>
      )}

      {/* Active session sub-header */}
      {activeSession && (
        <div className="shrink-0 border-b border-white/6 px-4 sm:px-6 py-2.5 flex items-center gap-3">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white/90 truncate">
              {activeSession.title || "Untitled meeting"}
            </p>
          </div>
          <p className="hidden sm:block text-[11px] text-white/30 shrink-0">
            {formatDistanceToNow(parseISO(activeSession.startedAt), {
              addSuffix: true,
            })}
            {activeSession.entries.length > 0 && (
              <>
                {" "}
                · {activeSession.entries.length} note
                {activeSession.entries.length !== 1 ? "s" : ""}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setDeleteTarget("__active__")}
            className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/28 hover:text-red-300 hover:bg-red-500/8 transition-all duration-200"
          >
            <X size={12} />
            Discard
          </button>
        </div>
      )}

      {/* Main scrollable area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {activeSession ? (
          activeSession.entries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-4">
                <StickyNote size={20} className="text-violet-400/60" />
              </div>
              <p className="text-sm font-semibold text-white/50 mb-1.5">
                No notes yet
              </p>
              <p className="text-xs text-white/25 max-w-xs leading-relaxed">
                Type a note below and press Enter — one per key point.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-3">
              {activeSession.entries.map((entry, index) => (
                <div key={entry.id} className="flex gap-3 animate-fade-in">
                  <div className="mt-1 shrink-0 h-5 w-5 rounded-full bg-white/5 border border-white/8 flex items-center justify-center text-[10px] font-medium text-white/28">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0 rounded-2xl bg-white/4 border border-white/7 px-4 py-2.5 rounded-tl-md">
                    <p className="text-sm text-white/82 leading-relaxed whitespace-pre-wrap">
                      {entry.content}
                    </p>
                    <p className="mt-1.5 text-[10px] text-white/24">
                      {format(parseISO(entry.createdAt), "h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={notesEndRef} />
            </div>
          )
        ) : (
          /* Idle — vertically centred, full height */
          <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-6">
              <Play size={28} className="text-violet-400/60 translate-x-0.5" />
            </div>
            <h2 className="text-lg font-bold text-white/80 mb-2">
              Start a meeting
            </h2>
            <p className="text-sm text-white/30 max-w-sm leading-relaxed mb-7">
              Jot one note per point as the conversation unfolds. Luna will
              write a summary note and create a follow-up task when you end.
            </p>
            <div className="w-full max-w-xs space-y-3">
              <input
                type="text"
                value={meetingTitle}
                onChange={(event) => setMeetingTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleStartMeeting();
                }}
                placeholder="Meeting title"
                className="w-full rounded-xl border border-white/8 bg-white/4 px-4 py-2.5 text-sm text-white/88 placeholder:text-white/22 outline-none transition-colors duration-200 focus:border-violet-400/30 focus:bg-white/5 text-center"
              />
              <button
                type="button"
                onClick={handleStartMeeting}
                disabled={!meetingReady || !meetingTitle.trim()}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-linear-to-r from-violet-500 to-blue-500 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:brightness-110 active:scale-[0.98] transition-all duration-200 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <Play size={15} className="translate-x-0.5" />
                Start meeting
              </button>
              {meetingReady && (
                <p className="text-[11px] text-white/22 leading-relaxed">
                  Session stays local to this browser. Only the final note and
                  task are saved to Orbit.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Anchored input bar — only when a session is active, mirrors Luna's input */}
      {activeSession && (
        <div className="shrink-0 border-t border-white/6 bg-orbit-950/80 backdrop-blur-sm">
          <form
            onSubmit={handleAddEntry}
            className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-3 flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                key={noteComposerKey}
                ref={noteInputRef}
                value={noteInput}
                onChange={(event) => setNoteInput(event.target.value)}
                onKeyDown={handleEntryKeyDown}
                rows={1}
                placeholder="Type a note and press Enter…"
                className="block w-full resize-none bg-white/4 border border-white/8 rounded-xl px-4 py-3 pr-4 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-violet-500/30 focus:bg-white/6 transition-colors duration-200 max-h-36 overflow-y-auto"
                style={{ height: "auto", minHeight: "48px" }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
                }}
              />
            </div>
            <button
              type="submit"
              disabled={!noteInput.trim()}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-white/65 hover:bg-white/8 hover:text-white/88 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">Add</span>
            </button>
            <button
              type="button"
              onClick={() => void handleEndMeeting()}
              disabled={ending || !meetingReady}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-linear-to-r from-violet-500 to-blue-500 text-xs font-semibold text-white shadow-md shadow-violet-500/20 hover:brightness-110 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ending ? (
                <LoaderCircle size={13} className="animate-spin" />
              ) : (
                <Square size={12} fill="currentColor" />
              )}
              <span className="hidden sm:inline">
                {ending ? "Generating…" : "End & save"}
              </span>
            </button>
          </form>
        </div>
      )}

      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Meeting history"
        maxWidth="max-w-4xl"
        panelClassName="sm:max-h-[82dvh]"
      >
        {sessions.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center text-center">
            <p className="text-sm text-white/34">No completed sessions yet</p>
            <p className="mt-1 text-xs text-white/22">
              End a meeting and it will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-white/7 bg-white/3 p-2">
              <div className="max-h-72 overflow-y-auto sm:max-h-[60dvh]">
                {sessions.map((session) => {
                  const selected = session.id === selectedHistorySessionId;
                  return (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setSelectedHistorySessionId(session.id)}
                      className={`flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm transition-all duration-200 ${
                        selected
                          ? "bg-violet-500/12 text-white border border-violet-400/20"
                          : "text-white/55 hover:bg-white/5 hover:text-white/80 border border-transparent"
                      }`}
                    >
                      <span className="truncate font-medium">
                        {session.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-white/7 bg-white/3 p-4 sm:p-5">
              {selectedHistorySession ? (
                <MeetingSessionDetail
                  session={selectedHistorySession}
                  onDelete={() => setDeleteTarget(selectedHistorySession.id)}
                />
              ) : (
                <div className="flex min-h-48 items-center justify-center text-sm text-white/30">
                  Select a meeting title to review the session.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmModal
        open={deleteTarget === "__active__"}
        onClose={() => setDeleteTarget(null)}
        title="Discard active meeting"
        message="Discard the current meeting session and all notes captured so far? This only affects local meeting history."
        confirmLabel="Discard meeting"
        onConfirm={handleDiscardActive}
      />

      <ConfirmModal
        open={!!deleteTarget && deleteTarget !== "__active__"}
        onClose={() => setDeleteTarget(null)}
        title="Delete meeting session"
        message="Delete this saved meeting session from local history? The note and task already created in Orbit will not be removed."
        confirmLabel="Delete session"
        onConfirm={() => {
          if (deleteTarget && deleteTarget !== "__active__") {
            handleDeleteSession(deleteTarget);
          }
        }}
      />
    </div>
  );
}

function MeetingSessionDetail({
  session,
  onDelete,
}: {
  session: MeetingSession;
  onDelete: () => void;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-white/90 truncate">
            {session.title}
          </p>
          <p className="mt-1 text-xs text-white/30">
            {session.endedAt
              ? formatSessionDate(session.endedAt)
              : formatSessionDate(session.startedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 p-1.5 rounded-lg text-white/22 hover:text-red-300 hover:bg-red-500/8 transition-colors"
          aria-label="Delete meeting session"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Artifact badges */}
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-[11px] text-white/42">
          <StickyNote size={10} />
          {session.entries.length} note
          {session.entries.length !== 1 ? "s" : ""}
        </span>
        {session.artifacts?.note.title && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/18 bg-violet-500/8 px-2.5 py-1 text-[11px] text-violet-300/88 max-w-52">
            <StickyNote size={10} className="shrink-0" />
            <span className="truncate">{session.artifacts.note.title}</span>
          </span>
        )}
        {session.artifacts?.task.title && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/18 bg-blue-500/8 px-2.5 py-1 text-[11px] text-blue-300/88 max-w-52">
            <ListTodo size={10} className="shrink-0" />
            <span className="truncate">{session.artifacts.task.title}</span>
          </span>
        )}
      </div>

      {/* AI warning */}
      {session.artifacts?.warning && (
        <div className="mt-2.5 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-100/62 flex items-start gap-2">
          <AlertTriangle
            size={11}
            className="mt-0.5 shrink-0 text-amber-300/80"
          />
          {session.artifacts.warning}
        </div>
      )}

      {/* Entry preview */}
      {session.entries.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {session.entries.map((entry, index) => (
            <div key={entry.id} className="flex gap-2.5">
              <div className="mt-0.5 shrink-0 h-4 w-4 rounded-full bg-white/4 border border-white/7 flex items-center justify-center text-[9px] font-medium text-white/22">
                {index + 1}
              </div>
              <p className="text-xs leading-relaxed text-white/50 whitespace-pre-wrap flex-1">
                {entry.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
