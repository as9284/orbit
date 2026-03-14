import { useEffect, useState, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  Plus,
  FolderOpen,
  Pencil,
  Trash2,
  CalendarDays,
  CheckCircle2,
  ListTodo,
  StickyNote,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { useTasksApi, useNotesApi } from "../components/layout/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { useProjects } from "../hooks/useProjects";
import { ConfirmModal } from "../components/ui/ConfirmModal";
import { Spinner } from "../components/ui/Spinner";
import { CreateProjectModal } from "../components/projects/CreateProjectModal";
import { EditProjectModal } from "../components/projects/EditProjectModal";
import { ProjectDetailModal } from "../components/projects/ProjectDetailModal";
import type { Project } from "../types/database.types";
import type { AiTaskDraft } from "../lib/openrouter";

// ── Color helpers ──────────────────────────────────────────────────────────────

const COLOR_CLASSES: Record<
  string,
  { dot: string; bar: string; ring: string; glow: string }
> = {
  violet: {
    dot: "bg-violet-500",
    bar: "bg-violet-500/70",
    ring: "border-violet-500/25",
    glow: "shadow-violet-500/10",
  },
  purple: {
    dot: "bg-purple-500",
    bar: "bg-purple-500/70",
    ring: "border-purple-500/25",
    glow: "shadow-purple-500/10",
  },
  indigo: {
    dot: "bg-indigo-500",
    bar: "bg-indigo-500/70",
    ring: "border-indigo-500/25",
    glow: "shadow-indigo-500/10",
  },
  blue: {
    dot: "bg-blue-500",
    bar: "bg-blue-500/70",
    ring: "border-blue-500/25",
    glow: "shadow-blue-500/10",
  },
  sky: {
    dot: "bg-sky-500",
    bar: "bg-sky-500/70",
    ring: "border-sky-500/25",
    glow: "shadow-sky-500/10",
  },
  cyan: {
    dot: "bg-cyan-500",
    bar: "bg-cyan-500/70",
    ring: "border-cyan-500/25",
    glow: "shadow-cyan-500/10",
  },
  teal: {
    dot: "bg-teal-500",
    bar: "bg-teal-500/70",
    ring: "border-teal-500/25",
    glow: "shadow-teal-500/10",
  },
  emerald: {
    dot: "bg-emerald-500",
    bar: "bg-emerald-500/70",
    ring: "border-emerald-500/25",
    glow: "shadow-emerald-500/10",
  },
  lime: {
    dot: "bg-lime-500",
    bar: "bg-lime-500/70",
    ring: "border-lime-500/25",
    glow: "shadow-lime-500/10",
  },
  amber: {
    dot: "bg-amber-500",
    bar: "bg-amber-500/70",
    ring: "border-amber-500/25",
    glow: "shadow-amber-500/10",
  },
  orange: {
    dot: "bg-orange-500",
    bar: "bg-orange-500/70",
    ring: "border-orange-500/25",
    glow: "shadow-orange-500/10",
  },
  red: {
    dot: "bg-red-500",
    bar: "bg-red-500/70",
    ring: "border-red-500/25",
    glow: "shadow-red-500/10",
  },
  rose: {
    dot: "bg-rose-500",
    bar: "bg-rose-500/70",
    ring: "border-rose-500/25",
    glow: "shadow-rose-500/10",
  },
  pink: {
    dot: "bg-pink-500",
    bar: "bg-pink-500/70",
    ring: "border-pink-500/25",
    glow: "shadow-pink-500/10",
  },
  fuchsia: {
    dot: "bg-fuchsia-500",
    bar: "bg-fuchsia-500/70",
    ring: "border-fuchsia-500/25",
    glow: "shadow-fuchsia-500/10",
  },
};

function getColorClasses(color: string) {
  if (color.startsWith("#")) {
    return { dot: "", bar: "", ring: "border-white/10", glow: "", hex: color };
  }
  return { ...(COLOR_CLASSES[color] ?? COLOR_CLASSES.violet), hex: null };
}

// ── Page component ────────────────────────────────────────────────────────────

export function ProjectsPage() {
  const { user, encryptionKey } = useAuth();
  const tasksApi = useTasksApi();
  const notesApi = useNotesApi();
  const projectsApi = useProjects(user!.id);

  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch tasks and notes on mount
  useEffect(() => {
    if (encryptionKey) {
      tasksApi.fetchActiveTasks();
      notesApi.fetchNotes();
    }
  }, [encryptionKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep detail project in sync when underlying project data changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!detailProject) return;
    const updated = projectsApi.projects.find((p) => p.id === detailProject.id);
    if (updated) setDetailProject(updated);
    else setDetailProject(null);
  }, [projectsApi.projects]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Projects enriched with computed progress
  const enrichedProjects = useMemo(() => {
    return projectsApi.projects.map((project) => {
      const linkedTasks = tasksApi.activeTasks.filter((t) =>
        project.taskIds.includes(t.id),
      );
      const completedCount = linkedTasks.filter((t) => t.completed).length;
      const totalCount = linkedTasks.length;
      const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
      return { project, completedCount, totalCount, progress };
    });
  }, [projectsApi.projects, tasksApi.activeTasks]);

  function handleDelete(id: string) {
    projectsApi.deleteProject(id);
    toast.success("Project deleted");
    setDeleteId(null);
  }

  const loading = tasksApi.loadingActive || notesApi.loading;

  return (
    <div className="min-h-screen px-4 sm:px-8 py-8 sm:py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8 animate-fade-in">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/25 mb-1">
            Orbit
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            Projects
          </h1>
          <p className="mt-1 text-sm text-white/35">
            Organize your tasks, notes, and meetings around goals.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-b from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/25 border border-violet-400/30 active:scale-95"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">New project</span>
        </button>
      </div>

      {/* Loading */}
      {loading && projectsApi.projects.length === 0 && (
        <div className="flex justify-center py-20">
          <Spinner size={24} className="text-white/20" />
        </div>
      )}

      {/* Empty state */}
      {!loading && projectsApi.projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-4">
            <FolderOpen size={24} className="text-white/20" />
          </div>
          <p className="text-base font-medium text-white/50 mb-1">
            No projects yet
          </p>
          <p className="text-sm text-white/25 max-w-xs">
            Create a project to group tasks, notes, and track your progress
            towards a goal.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-linear-to-b from-violet-500 to-violet-600 hover:from-violet-400 hover:to-violet-500 text-white text-sm font-medium transition-all shadow-lg shadow-violet-500/25 border border-violet-400/30 active:scale-95"
          >
            <Plus size={15} />
            New project
          </button>
        </div>
      )}

      {/* Project grid */}
      {projectsApi.projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {enrichedProjects.map(
            ({ project, completedCount, totalCount, progress }, index) => {
              const colors = getColorClasses(project.color);
              const isOverdue =
                project.deadline &&
                isPast(parseISO(project.deadline)) &&
                !isToday(parseISO(project.deadline));
              const isDueToday =
                project.deadline && isToday(parseISO(project.deadline));

              return (
                <div
                  key={project.id}
                  onClick={() => setDetailProject(project)}
                  style={{
                    animationDelay: `${index * 60}ms`,
                    ...(colors.hex
                      ? {
                          borderColor: `${colors.hex}40`,
                          boxShadow: `0 4px 24px ${colors.hex}1a`,
                        }
                      : undefined),
                  }}
                  className={`group relative rounded-2xl border bg-white/3 hover:bg-white/5 cursor-pointer transition-all duration-200 p-5 shadow-lg animate-slide-up ${colors.ring} ${colors.glow}`}
                >
                  {/* Color dot accent */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot}`}
                        style={
                          colors.hex
                            ? { backgroundColor: colors.hex }
                            : undefined
                        }
                      />
                      <h3 className="text-sm font-semibold text-white/85 truncate">
                        {project.name}
                      </h3>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditProject(project);
                        }}
                        aria-label="Edit project"
                        className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-all"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(project.id);
                        }}
                        aria-label="Delete project"
                        className="p-1.5 rounded-lg text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {project.description && (
                    <p className="text-xs text-white/40 mb-3 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  {/* Progress bar */}
                  {totalCount > 0 && (
                    <div className="mb-3">
                      <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                          style={
                            colors.hex
                              ? {
                                  width: `${progress}%`,
                                  backgroundColor: colors.hex,
                                  opacity: 0.75,
                                }
                              : { width: `${progress}%` }
                          }
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-white/30 tabular-nums">
                        {completedCount}/{totalCount} tasks ·{" "}
                        {Math.round(progress)}%
                      </p>
                    </div>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {project.deadline && (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] ${
                          isOverdue
                            ? "text-rose-400"
                            : isDueToday
                              ? "text-amber-400"
                              : "text-white/30"
                        }`}
                      >
                        <CalendarDays size={10} />
                        {format(parseISO(project.deadline), "MMM d")}
                        {isOverdue && " · Overdue"}
                        {isDueToday && " · Today"}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/25">
                      <ListTodo size={10} />
                      {totalCount}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-white/25">
                      <StickyNote size={10} />
                      {project.noteIds.length}
                    </span>
                    {completedCount === totalCount && totalCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/70">
                        <CheckCircle2 size={10} />
                        Done
                      </span>
                    )}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {/* Modals */}
      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={async (data, starterTasks?: AiTaskDraft[]) => {
          const project = projectsApi.createProject(data);
          if (starterTasks && starterTasks.length > 0) {
            for (const draft of starterTasks) {
              const taskId = await tasksApi.createTask({
                title: draft.title,
                description: draft.description || undefined,
                priority: draft.priority,
              });
              if (taskId) {
                if (draft.subTasks.length > 0) {
                  await tasksApi.saveSubTasks(
                    taskId,
                    draft.subTasks.map((t) => ({ title: t })),
                    [],
                  );
                }
                projectsApi.linkTask(project.id, taskId);
              }
            }
            toast.success(
              `Project created with ${starterTasks.length} starter task${starterTasks.length !== 1 ? "s" : ""}`,
            );
          } else {
            toast.success("Project created");
          }
        }}
      />

      <EditProjectModal
        project={editProject}
        onClose={() => setEditProject(null)}
        onSave={(id, data) => {
          projectsApi.updateProject(id, data);
          toast.success("Project updated");
        }}
      />

      <ProjectDetailModal
        project={detailProject}
        allTasks={tasksApi.activeTasks}
        allNotes={notesApi.notes}
        projectsApi={projectsApi}
        onClose={() => setDetailProject(null)}
      />

      <ConfirmModal
        open={!!deleteId}
        title="Delete project"
        message="This will permanently delete the project. Linked tasks and notes will not be affected."
        confirmLabel="Delete"
        onConfirm={() => deleteId && handleDelete(deleteId)}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
}
