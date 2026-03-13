import { useState, useCallback, useEffect } from "react";
import type { Project, ProjectColor } from "../types/database.types";

export interface CreateProjectData {
  name: string;
  description?: string;
  color?: ProjectColor;
  deadline?: string | null;
  taskIds?: string[];
  noteIds?: string[];
}

function storageKey(userId: string): string {
  return `orbit:projects:${userId}`;
}

function readProjects(userId: string): Project[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    return JSON.parse(raw) as Project[];
  } catch {
    return [];
  }
}

function writeProjects(userId: string, projects: Project[]): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(projects));
}

export function useProjects(userId: string) {
  const [projects, setProjects] = useState<Project[]>(() =>
    readProjects(userId),
  );

  // Sync across tabs / windows
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === storageKey(userId)) {
        setProjects(readProjects(userId));
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [userId]);

  const createProject = useCallback(
    (data: CreateProjectData): Project => {
      const now = new Date().toISOString();
      const project: Project = {
        id: crypto.randomUUID(),
        userId,
        name: data.name.trim(),
        description: data.description?.trim() ?? "",
        color: data.color ?? "violet",
        deadline: data.deadline ?? null,
        taskIds: data.taskIds ?? [],
        noteIds: data.noteIds ?? [],
        createdAt: now,
        updatedAt: now,
      };
      const updated = [project, ...readProjects(userId)];
      writeProjects(userId, updated);
      setProjects(updated);
      return project;
    },
    [userId],
  );

  const updateProject = useCallback(
    (id: string, updates: Partial<CreateProjectData>): boolean => {
      const existing = readProjects(userId);
      const idx = existing.findIndex((p) => p.id === id);
      if (idx === -1) return false;
      const updated: Project[] = existing.map((p) =>
        p.id === id
          ? {
              ...p,
              ...(updates.name !== undefined && {
                name: updates.name.trim(),
              }),
              ...(updates.description !== undefined && {
                description: updates.description.trim(),
              }),
              ...(updates.color !== undefined && { color: updates.color }),
              ...(updates.deadline !== undefined && {
                deadline: updates.deadline,
              }),
              ...(updates.taskIds !== undefined && {
                taskIds: updates.taskIds,
              }),
              ...(updates.noteIds !== undefined && {
                noteIds: updates.noteIds,
              }),
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      writeProjects(userId, updated);
      setProjects(updated);
      return true;
    },
    [userId],
  );

  const deleteProject = useCallback(
    (id: string): boolean => {
      const existing = readProjects(userId);
      const filtered = existing.filter((p) => p.id !== id);
      if (filtered.length === existing.length) return false;
      writeProjects(userId, filtered);
      setProjects(filtered);
      return true;
    },
    [userId],
  );

  const linkTask = useCallback(
    (projectId: string, taskId: string): void => {
      const existing = readProjects(userId);
      const updated = existing.map((p) =>
        p.id === projectId && !p.taskIds.includes(taskId)
          ? {
              ...p,
              taskIds: [...p.taskIds, taskId],
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      writeProjects(userId, updated);
      setProjects(updated);
    },
    [userId],
  );

  const unlinkTask = useCallback(
    (projectId: string, taskId: string): void => {
      const existing = readProjects(userId);
      const updated = existing.map((p) =>
        p.id === projectId
          ? {
              ...p,
              taskIds: p.taskIds.filter((id) => id !== taskId),
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      writeProjects(userId, updated);
      setProjects(updated);
    },
    [userId],
  );

  const linkNote = useCallback(
    (projectId: string, noteId: string): void => {
      const existing = readProjects(userId);
      const updated = existing.map((p) =>
        p.id === projectId && !p.noteIds.includes(noteId)
          ? {
              ...p,
              noteIds: [...p.noteIds, noteId],
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      writeProjects(userId, updated);
      setProjects(updated);
    },
    [userId],
  );

  const unlinkNote = useCallback(
    (projectId: string, noteId: string): void => {
      const existing = readProjects(userId);
      const updated = existing.map((p) =>
        p.id === projectId
          ? {
              ...p,
              noteIds: p.noteIds.filter((id) => id !== noteId),
              updatedAt: new Date().toISOString(),
            }
          : p,
      );
      writeProjects(userId, updated);
      setProjects(updated);
    },
    [userId],
  );

  return {
    projects,
    createProject,
    updateProject,
    deleteProject,
    linkTask,
    unlinkTask,
    linkNote,
    unlinkNote,
  };
}

export type ProjectsApi = ReturnType<typeof useProjects>;
