import { useState, useCallback, useMemo, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  FileText,
  Sparkles,
  CalendarDays,
  ListTodo,
  StickyNote,
  Link,
  Unlink,
  LoaderCircle,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { toast } from "react-hot-toast";
import { Modal } from "../ui/Modal";
import type { Project, Task, Note } from "../../types/database.types";
import type { ProjectsApi } from "../../hooks/useProjects";
import {
  generateProjectSummary,
  type AiProjectSummary,
} from "../../lib/openrouter";
import { hasApiKey } from "../../lib/ai";

// ── Color helpers ──────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<
  string,
  { dot: string; bar: string; badge: string }
> = {
  violet: {
    dot: "bg-violet-500",
    bar: "bg-violet-500/70",
    badge: "bg-violet-500/15 text-violet-300",
  },
  purple: {
    dot: "bg-purple-500",
    bar: "bg-purple-500/70",
    badge: "bg-purple-500/15 text-purple-300",
  },
  indigo: {
    dot: "bg-indigo-500",
    bar: "bg-indigo-500/70",
    badge: "bg-indigo-500/15 text-indigo-300",
  },
  blue: {
    dot: "bg-blue-500",
    bar: "bg-blue-500/70",
    badge: "bg-blue-500/15 text-blue-300",
  },
  sky: {
    dot: "bg-sky-500",
    bar: "bg-sky-500/70",
    badge: "bg-sky-500/15 text-sky-300",
  },
  cyan: {
    dot: "bg-cyan-500",
    bar: "bg-cyan-500/70",
    badge: "bg-cyan-500/15 text-cyan-300",
  },
  teal: {
    dot: "bg-teal-500",
    bar: "bg-teal-500/70",
    badge: "bg-teal-500/15 text-teal-300",
  },
  emerald: {
    dot: "bg-emerald-500",
    bar: "bg-emerald-500/70",
    badge: "bg-emerald-500/15 text-emerald-300",
  },
  lime: {
    dot: "bg-lime-500",
    bar: "bg-lime-500/70",
    badge: "bg-lime-500/15 text-lime-300",
  },
  amber: {
    dot: "bg-amber-500",
    bar: "bg-amber-500/70",
    badge: "bg-amber-500/15 text-amber-300",
  },
  orange: {
    dot: "bg-orange-500",
    bar: "bg-orange-500/70",
    badge: "bg-orange-500/15 text-orange-300",
  },
  red: {
    dot: "bg-red-500",
    bar: "bg-red-500/70",
    badge: "bg-red-500/15 text-red-300",
  },
  rose: {
    dot: "bg-rose-500",
    bar: "bg-rose-500/70",
    badge: "bg-rose-500/15 text-rose-300",
  },
  pink: {
    dot: "bg-pink-500",
    bar: "bg-pink-500/70",
    badge: "bg-pink-500/15 text-pink-300",
  },
  fuchsia: {
    dot: "bg-fuchsia-500",
    bar: "bg-fuchsia-500/70",
    badge: "bg-fuchsia-500/15 text-fuchsia-300",
  },
};

function getColorClasses(color: string) {
  if (color.startsWith("#")) {
    return { dot: "", bar: "", badge: "bg-white/8 text-white/60", hex: color };
  }
  return { ...(COLOR_CLASSES[color] ?? COLOR_CLASSES.violet), hex: null };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ProjectDetailModalProps {
  project: Project | null;
  allTasks: Task[];
  allNotes: Note[];
  projectsApi: ProjectsApi;
  onClose: () => void;
}

export function ProjectDetailModal({
  project,
  allTasks,
  allNotes,
  projectsApi,
  onClose,
}: ProjectDetailModalProps) {
  const [tab, setTab] = useState<"overview" | "tasks" | "notes">("overview");
  const [aiSummary, setAiSummary] = useState<AiProjectSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  const [displayProject, setDisplayProject] = useState(project);

  useEffect(() => {
    if (project) {
      setDisplayProject(project);
    }
  }, [project]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const dp = project ?? displayProject;

  const colors = dp ? getColorClasses(dp.color) : getColorClasses("");

  const linkedTasks = useMemo(
    () => (dp ? allTasks.filter((t) => dp.taskIds.includes(t.id)) : []),
    [dp, allTasks],
  );
  const unlinkedTasks = useMemo(
    () =>
      dp
        ? allTasks.filter((t) => !dp.taskIds.includes(t.id) && !t.archived)
        : [],
    [dp, allTasks],
  );

  const linkedNotes = useMemo(
    () => (dp ? allNotes.filter((n) => dp.noteIds.includes(n.id)) : []),
    [dp, allNotes],
  );
  const unlinkedNotes = useMemo(
    () => (dp ? allNotes.filter((n) => !dp.noteIds.includes(n.id)) : []),
    [dp, allNotes],
  );

  const completedCount = linkedTasks.filter((t) => t.completed).length;
  const totalCount = linkedTasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const isDeadlinePast =
    dp?.deadline &&
    isPast(parseISO(dp.deadline)) &&
    !isToday(parseISO(dp.deadline));
  const isDeadlineToday = dp?.deadline && isToday(parseISO(dp.deadline));

  const handleGenerateSummary = useCallback(async () => {
    if (!dp) return;
    setAiLoading(true);
    setAiError(null);
    const result = await generateProjectSummary(
      dp.name,
      dp.description,
      dp.deadline,
      linkedTasks.map((t) => t.title),
      completedCount,
      linkedNotes.map((n) => n.title),
    );
    setAiLoading(false);
    if (result.error) {
      setAiError(result.error);
      toast.error(result.error);
    } else {
      setAiSummary(result.summary);
    }
  }, [dp, linkedTasks, completedCount, linkedNotes]);

  function handleLinkTask(taskId: string) {
    if (!dp) return;
    projectsApi.linkTask(dp.id, taskId);
    toast.success("Task linked to project");
  }

  function handleUnlinkTask(taskId: string) {
    if (!dp) return;
    projectsApi.unlinkTask(dp.id, taskId);
    toast.success("Task unlinked");
  }

  function handleLinkNote(noteId: string) {
    if (!dp) return;
    projectsApi.linkNote(dp.id, noteId);
    toast.success("Note linked to project");
  }

  function handleUnlinkNote(noteId: string) {
    if (!dp) return;
    projectsApi.unlinkNote(dp.id, noteId);
    toast.success("Note unlinked");
  }

  return (
    <Modal
      open={!!project}
      onClose={onClose}
      title={dp?.name ?? ""}
      maxWidth="max-w-2xl"
    >
      {dp && (
        <div className="space-y-5">
          {/* Header meta */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colors.badge}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${colors.dot}`}
                style={colors.hex ? { backgroundColor: colors.hex } : undefined}
              />
              {colors.hex
                ? "Custom"
                : dp.color.charAt(0).toUpperCase() + dp.color.slice(1)}
            </span>
            {dp.deadline && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                  isDeadlinePast
                    ? "bg-rose-500/15 text-rose-300"
                    : isDeadlineToday
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-white/8 text-white/50"
                }`}
              >
                <CalendarDays size={11} />
                {format(parseISO(dp.deadline), "MMM d, yyyy")}
                {isDeadlinePast && " · Overdue"}
                {isDeadlineToday && " · Due today"}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/6 text-white/45">
              <ListTodo size={11} />
              {totalCount} task{totalCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/6 text-white/45">
              <StickyNote size={11} />
              {linkedNotes.length} note{linkedNotes.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/40">Progress</span>
                <span className="text-xs text-white/60 font-medium tabular-nums">
                  {completedCount}/{totalCount} ({Math.round(progress)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                  style={
                    colors.hex
                      ? {
                          width: `${progress}%`,
                          backgroundColor: colors.hex,
                          opacity: 0.8,
                        }
                      : { width: `${progress}%` }
                  }
                />
              </div>
            </div>
          )}

          {/* Description */}
          {dp.description && (
            <p className="text-sm text-white/55 leading-relaxed">
              {dp.description}
            </p>
          )}

          {/* Tabs */}
          <div className="flex gap-1 border-b border-white/7 pb-0">
            {(["overview", "tasks", "notes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative px-3 py-2 text-xs font-medium transition-all duration-150 capitalize ${
                  tab === t ? "text-white" : "text-white/40 hover:text-white/70"
                }`}
              >
                {t}
                {tab === t && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400 rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content — keyed so switching triggers entry animation */}
          {/* Overview tab */}
          {tab === "overview" && (
            <div key="overview" className="space-y-4 animate-slide-up">
              {/* Luna AI summary */}
              {hasApiKey() && (
                <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-violet-400" />
                      <span className="text-xs font-semibold text-white/70">
                        Luna AI Brief
                      </span>
                    </div>
                    <button
                      onClick={handleGenerateSummary}
                      disabled={aiLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 transition-all disabled:opacity-50"
                    >
                      {aiLoading ? (
                        <>
                          <LoaderCircle
                            size={11}
                            className="animate-spin shrink-0"
                          />
                          Analyzing…
                        </>
                      ) : (
                        <>
                          <Sparkles size={11} />
                          {aiSummary ? "Refresh" : "Generate"}
                        </>
                      )}
                    </button>
                  </div>

                  {aiError && !aiLoading && (
                    <p className="text-xs text-rose-400/80">{aiError}</p>
                  )}

                  {!aiSummary && !aiLoading && !aiError && (
                    <p className="text-xs text-white/30 italic">
                      Ask Luna to analyze your project progress and suggest next
                      steps.
                    </p>
                  )}

                  {aiSummary && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-white/85">
                        {aiSummary.headline}
                      </p>
                      <p className="text-xs text-white/55 leading-relaxed">
                        {aiSummary.status}
                      </p>
                      {aiSummary.suggestions.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-1.5">
                            Suggestions
                          </p>
                          <ul className="space-y-1">
                            {aiSummary.suggestions.map((s, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-white/60"
                              >
                                <span className="mt-1 w-1 h-1 rounded-full bg-violet-400/70 shrink-0" />
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {aiSummary.risks.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-amber-400/60 uppercase tracking-wide mb-1.5">
                            Risks
                          </p>
                          <ul className="space-y-1">
                            {aiSummary.risks.map((r, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-amber-300/70"
                              >
                                <span className="mt-1 w-1 h-1 rounded-full bg-amber-400/70 shrink-0" />
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Recent activity */}
              <div>
                <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">
                  Recent activity
                </p>
                {linkedTasks.length === 0 && linkedNotes.length === 0 ? (
                  <p className="text-xs text-white/25 italic">
                    No tasks or notes linked yet. Use the Tasks and Notes tabs
                    to link items.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {[...linkedTasks, ...linkedNotes]
                      .sort(
                        (a, b) =>
                          new Date(b.updated_at).getTime() -
                          new Date(a.updated_at).getTime(),
                      )
                      .slice(0, 6)
                      .map((item) => {
                        const isTask = "completed" in item;
                        return (
                          <li
                            key={item.id}
                            className="flex items-center gap-2 text-xs text-white/50"
                          >
                            {isTask ? (
                              (item as Task).completed ? (
                                <CheckCircle2
                                  size={12}
                                  className="text-emerald-400/70 shrink-0"
                                />
                              ) : (
                                <Circle
                                  size={12}
                                  className="text-white/25 shrink-0"
                                />
                              )
                            ) : (
                              <FileText
                                size={12}
                                className="text-violet-400/70 shrink-0"
                              />
                            )}
                            <span className="truncate flex-1">
                              {item.title}
                            </span>
                            <span className="text-white/25 shrink-0 tabular-nums">
                              {format(parseISO(item.updated_at), "MMM d")}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Tasks tab */}
          {tab === "tasks" && (
            <div key="tasks" className="space-y-4 animate-slide-up">
              {/* Linked tasks */}
              {linkedTasks.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">
                    Linked tasks ({linkedTasks.length})
                  </p>
                  <ul className="space-y-1.5">
                    {linkedTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/3 border border-white/6 group"
                      >
                        {task.completed ? (
                          <CheckCircle2
                            size={13}
                            className="text-emerald-400/70 shrink-0"
                          />
                        ) : (
                          <Circle
                            size={13}
                            className="text-white/25 shrink-0"
                          />
                        )}
                        <span
                          className={`flex-1 truncate text-sm ${task.completed ? "line-through text-white/30" : "text-white/70"}`}
                        >
                          {task.title}
                        </span>
                        <button
                          onClick={() => handleUnlinkTask(task.id)}
                          aria-label="Unlink task"
                          className="p-1 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Unlink size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Linkable tasks */}
              {unlinkedTasks.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">
                    Add tasks
                  </p>
                  <ul className="space-y-1.5 max-h-52 overflow-y-auto">
                    {unlinkedTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/2 border border-white/5 group"
                      >
                        <Circle size={13} className="text-white/20 shrink-0" />
                        <span className="flex-1 truncate text-sm text-white/45">
                          {task.title}
                        </span>
                        <button
                          onClick={() => handleLinkTask(task.id)}
                          aria-label="Link task"
                          className="p-1 rounded-lg text-white/20 hover:text-violet-400 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Link size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {linkedTasks.length === 0 && unlinkedTasks.length === 0 && (
                <p className="text-xs text-white/25 italic">
                  No tasks available.
                </p>
              )}
            </div>
          )}

          {/* Notes tab */}
          {tab === "notes" && (
            <div key="notes" className="space-y-4 animate-slide-up">
              {/* Linked notes */}
              {linkedNotes.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">
                    Linked notes ({linkedNotes.length})
                  </p>
                  <ul className="space-y-1.5">
                    {linkedNotes.map((note) => (
                      <li
                        key={note.id}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/3 border border-white/6 group"
                      >
                        <FileText
                          size={13}
                          className="text-violet-400/70 shrink-0"
                        />
                        <span className="flex-1 truncate text-sm text-white/70">
                          {note.title}
                        </span>
                        <button
                          onClick={() => handleUnlinkNote(note.id)}
                          aria-label="Unlink note"
                          className="p-1 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Unlink size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Linkable notes */}
              {unlinkedNotes.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-white/35 uppercase tracking-wide mb-2">
                    Add notes
                  </p>
                  <ul className="space-y-1.5 max-h-52 overflow-y-auto">
                    {unlinkedNotes.map((note) => (
                      <li
                        key={note.id}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 bg-white/2 border border-white/5 group"
                      >
                        <FileText
                          size={13}
                          className="text-white/20 shrink-0"
                        />
                        <span className="flex-1 truncate text-sm text-white/45">
                          {note.title}
                        </span>
                        <button
                          onClick={() => handleLinkNote(note.id)}
                          aria-label="Link note"
                          className="p-1 rounded-lg text-white/20 hover:text-violet-400 hover:bg-violet-500/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Link size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {linkedNotes.length === 0 && unlinkedNotes.length === 0 && (
                <p className="text-xs text-white/25 italic">
                  No notes available.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
