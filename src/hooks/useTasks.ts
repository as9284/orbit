import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { encrypt, decrypt } from "../lib/encryption";
import { getOpenRouterKey, categorizeTask } from "../lib/openrouter";
import type { Task, SubTask } from "../types/database.types";

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  due_date?: string | null;
}

export interface SubTaskInput {
  id?: string;
  title: string;
  completed?: boolean;
}

async function decryptTask(task: Task, key: CryptoKey): Promise<Task> {
  return {
    ...task,
    title: await decrypt(task.title, key),
    description: task.description ? await decrypt(task.description, key) : null,
  };
}

async function decryptTasks(tasks: Task[], key: CryptoKey): Promise<Task[]> {
  return Promise.all(tasks.map((t) => decryptTask(t, key)));
}

async function decryptSubTask(st: SubTask, key: CryptoKey): Promise<SubTask> {
  return { ...st, title: await decrypt(st.title, key) };
}

async function decryptSubTasks(
  sts: SubTask[],
  key: CryptoKey,
): Promise<SubTask[]> {
  return Promise.all(sts.map((s) => decryptSubTask(s, key)));
}

export function useTasks(userId: string, encryptionKey: CryptoKey | null) {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  const categoriesKey = `orbit:categories:${userId}`;
  const [categories, setCategories] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`orbit:categories:${userId}`) ?? "{}",
      ) as Record<string, string>;
    } catch {
      return {};
    }
  });
  const [isCategorizingBackground, setIsCategorizingBackground] =
    useState(false);
  const categorizingRef = useRef(false);

  const readStoredCategories = useCallback((): Record<string, string> => {
    try {
      return JSON.parse(localStorage.getItem(categoriesKey) ?? "{}") as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  }, [categoriesKey]);

  const writeStoredCategories = useCallback(
    (next: Record<string, string>) => {
      localStorage.setItem(categoriesKey, JSON.stringify(next));
      setCategories({ ...next });
    },
    [categoriesKey],
  );

  const getExistingCategoryPool = useCallback(
    (stored: Record<string, string>): string[] => {
      return [...new Set(Object.values(stored).filter(Boolean))].sort();
    },
    [],
  );

  // Listen for category-clear events dispatched by the settings panel
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ userId: string }>;
      if (ce.detail.userId === userId) setCategories({});
    };
    window.addEventListener("orbit:categories:cleared", handler);
    return () =>
      window.removeEventListener("orbit:categories:cleared", handler);
  }, [userId]);

  /**
   * Categorise all tasks that don't yet have a category.
   * Reads the OpenRouter key from localStorage, prunes orphaned entries,
   * and processes tasks sequentially to stay within free-tier rate limits.
   */
  const backgroundCategorize = useCallback(
    async (tasks: Task[]) => {
      if (categorizingRef.current) return;
      const apiKey = getOpenRouterKey();
      if (!apiKey) return;
      categorizingRef.current = true;
      setIsCategorizingBackground(true);
      setAiStatus(null);
      try {
        const stored = readStoredCategories();
        // Remove categories for tasks that no longer exist
        const taskIds = new Set(tasks.map((t) => t.id));
        const pruned: Record<string, string> = {};
        for (const [id, cat] of Object.entries(stored)) {
          if (taskIds.has(id)) pruned[id] = cat;
        }
        const uncategorized = tasks.filter((t) => !pruned[t.id]);
        writeStoredCategories(pruned);

        for (const task of uncategorized) {
          if (!categorizingRef.current) break;
          const existingCategories = getExistingCategoryPool(pruned);
          const result = await categorizeTask(
            task.title,
            task.description,
            apiKey,
            existingCategories,
          );
          if (result.category) {
            pruned[task.id] = result.category;
            writeStoredCategories(pruned);
            if (result.model) {
              setAiStatus(`Using ${result.model}`);
            }
            continue;
          }

          if (result.error) {
            setAiStatus(result.error);
            setError(`AI categorization failed: ${result.error}`);
            break;
          }
        }
      } finally {
        setIsCategorizingBackground(false);
        categorizingRef.current = false;
      }
    },
    [readStoredCategories, writeStoredCategories], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const categorizeSingleTask = useCallback(
    async ({
      taskId,
      title,
      description,
    }: {
      taskId: string;
      title: string;
      description?: string | null;
    }) => {
      const apiKey = getOpenRouterKey();
      if (!apiKey) {
        return {
          category: null,
          model: null,
          error: "Missing OpenRouter API key.",
        };
      }

      const stored = readStoredCategories();
      const existingCategories = getExistingCategoryPool(stored);
      const result = await categorizeTask(
        title,
        description,
        apiKey,
        existingCategories,
      );
      if (result.category) {
        stored[taskId] = result.category;
        writeStoredCategories(stored);
        if (result.model) {
          setAiStatus(`Using ${result.model}`);
        }
        return result;
      }

      if (result.error) {
        setAiStatus(result.error);
        setError(`AI categorization failed: ${result.error}`);
      }

      return result;
    },
    [getExistingCategoryPool, readStoredCategories, writeStoredCategories],
  );

  const fetchActiveTasks = useCallback(async () => {
    if (!encryptionKey) return;
    setLoadingActive(true);
    setError(null);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (error) {
      setLoadingActive(false);
      setError(error.message);
      return;
    }
    const decrypted = await decryptTasks(data ?? [], encryptionKey);
    const openTasks = decrypted.filter((task) => !task.completed);
    const completedTasks = decrypted.filter((task) => task.completed);
    setActiveTasks(openTasks);

    if (completedTasks.length > 0) {
      const archivedAt = new Date().toISOString();
      const completedIds = completedTasks.map((task) => task.id);
      const { error: archiveError } = await supabase
        .from("tasks")
        .update({ archived: true, archived_at: archivedAt })
        .in("id", completedIds);

      if (archiveError) {
        setError(archiveError.message);
      } else {
        setArchivedTasks((prev) => [
          ...completedTasks.map((task) => ({
            ...task,
            archived: true,
            archived_at: archivedAt,
          })),
          ...prev.filter((task) => !completedIds.includes(task.id)),
        ]);
      }
    }

    setLoadingActive(false);
  }, [userId, encryptionKey]);

  const fetchArchivedTasks = useCallback(async () => {
    if (!encryptionKey) return;
    setLoadingArchived(true);
    setError(null);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", true)
      .order("archived_at", { ascending: false });
    if (error) {
      setLoadingArchived(false);
      setError(error.message);
      return;
    }
    const decrypted = await decryptTasks(data ?? [], encryptionKey);
    setArchivedTasks(decrypted);
    setLoadingArchived(false);
  }, [userId, encryptionKey]);

  const createTask = async (data: CreateTaskData): Promise<string | null> => {
    if (!encryptionKey) return null;
    const encTitle = await encrypt(data.title.trim(), encryptionKey);
    const encDesc = data.description?.trim()
      ? await encrypt(data.description.trim(), encryptionKey)
      : null;
    const { data: inserted, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: encTitle,
        description: encDesc,
        priority: data.priority ?? "medium",
        due_date: data.due_date || null,
      })
      .select("id")
      .single();
    if (error) {
      setError(error.message);
      return null;
    }
    await fetchActiveTasks();
    return inserted.id;
  };

  const updateTask = async (
    id: string,
    updates: Partial<CreateTaskData>,
  ): Promise<boolean> => {
    if (!encryptionKey) return false;
    const encTitle = updates.title?.trim()
      ? await encrypt(updates.title.trim(), encryptionKey)
      : undefined;
    const encDesc =
      updates.description !== undefined
        ? updates.description?.trim()
          ? await encrypt(updates.description.trim(), encryptionKey)
          : null
        : undefined;
    const { error } = await supabase
      .from("tasks")
      .update({
        title: encTitle,
        description: encDesc,
        priority: updates.priority,
        due_date: updates.due_date,
      })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    await fetchActiveTasks();
    return true;
  };

  const toggleComplete = async (
    id: string,
    completed: boolean,
  ): Promise<boolean> => {
    const archivedAt = completed ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("tasks")
      .update({
        completed,
        archived: completed,
        archived_at: archivedAt,
      })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }

    if (completed) {
      const completedTask = activeTasks.find((t) => t.id === id);
      setActiveTasks((prev) => prev.filter((t) => t.id !== id));
      if (completedTask) {
        setArchivedTasks((prev) => [
          {
            ...completedTask,
            completed: true,
            archived: true,
            archived_at: archivedAt,
          },
          ...prev.filter((t) => t.id !== id),
        ]);
      }
      return true;
    }

    setActiveTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, completed: false, archived: false, archived_at: null }
          : t,
      ),
    );
    return true;
  };

  const archiveTask = async (id: string): Promise<boolean> => {
    const archivedTask = activeTasks.find((t) => t.id === id);
    const archivedAt = new Date().toISOString();
    const { error } = await supabase
      .from("tasks")
      .update({ archived: true, archived_at: archivedAt })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    setActiveTasks((prev) => prev.filter((t) => t.id !== id));
    if (archivedTask) {
      setArchivedTasks((prev) => [
        {
          ...archivedTask,
          archived: true,
          archived_at: archivedAt,
        },
        ...prev.filter((t) => t.id !== id),
      ]);
    }
    return true;
  };

  const unarchiveTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("tasks")
      .update({ archived: false, archived_at: null, completed: false })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    const restoredTask = archivedTasks.find((t) => t.id === id);
    setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
    if (restoredTask) {
      setActiveTasks((prev) => [
        {
          ...restoredTask,
          archived: false,
          archived_at: null,
          completed: false,
        },
        ...prev,
      ]);
    }
    return true;
  };

  const deleteForever = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
    return true;
  };

  // ── Sub-tasks ─────────────────────────────────────────────────────────

  const fetchSubTasks = async (taskId: string): Promise<SubTask[]> => {
    if (!encryptionKey) return [];
    const { data, error } = await supabase
      .from("sub_tasks")
      .select("*")
      .eq("task_id", taskId)
      .order("position", { ascending: true });
    if (error) {
      setError(error.message);
      return [];
    }
    return decryptSubTasks(data ?? [], encryptionKey);
  };

  const fetchSubTaskCount = async (taskId: string): Promise<number> => {
    const { count, error } = await supabase
      .from("sub_tasks")
      .select("id", { count: "exact" })
      .eq("task_id", taskId);

    if (error) {
      setError(error.message);
      return 0;
    }

    return count ?? 0;
  };

  const saveSubTasks = async (
    taskId: string,
    subTasks: SubTaskInput[],
    existingIds: string[],
  ): Promise<boolean> => {
    if (!encryptionKey) return false;

    // Determine which existing sub-tasks to delete
    const newIds = subTasks.filter((s) => s.id).map((s) => s.id!);
    const toDelete = existingIds.filter((id) => !newIds.includes(id));

    // Delete removed sub-tasks
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from("sub_tasks")
        .delete()
        .in("id", toDelete);
      if (error) {
        setError(error.message);
        return false;
      }
    }

    // Upsert remaining
    for (let i = 0; i < subTasks.length; i++) {
      const st = subTasks[i];
      const encTitle = await encrypt(st.title.trim(), encryptionKey);

      if (st.id) {
        // Update existing
        const { error } = await supabase
          .from("sub_tasks")
          .update({
            title: encTitle,
            completed: st.completed ?? false,
            position: i,
          })
          .eq("id", st.id);
        if (error) {
          setError(error.message);
          return false;
        }
      } else {
        // Insert new
        const { error } = await supabase.from("sub_tasks").insert({
          task_id: taskId,
          user_id: userId,
          title: encTitle,
          completed: st.completed ?? false,
          position: i,
        });
        if (error) {
          setError(error.message);
          return false;
        }
      }
    }
    return true;
  };

  const toggleSubTaskComplete = async (
    subTaskId: string,
    completed: boolean,
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("sub_tasks")
      .update({ completed })
      .eq("id", subTaskId);
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  };

  const updateSubTaskTitle = async (
    subTaskId: string,
    title: string,
  ): Promise<boolean> => {
    if (!encryptionKey) return false;
    const encTitle = await encrypt(title.trim(), encryptionKey);
    const { error } = await supabase
      .from("sub_tasks")
      .update({ title: encTitle })
      .eq("id", subTaskId);
    if (error) {
      setError(error.message);
      return false;
    }
    return true;
  };

  return {
    activeTasks,
    archivedTasks,
    loadingActive,
    loadingArchived,
    error,
    fetchActiveTasks,
    fetchArchivedTasks,
    createTask,
    updateTask,
    toggleComplete,
    archiveTask,
    unarchiveTask,
    deleteForever,
    fetchSubTasks,
    fetchSubTaskCount,
    saveSubTasks,
    toggleSubTaskComplete,
    updateSubTaskTitle,
    categories,
    isCategorizingBackground,
    aiStatus,
    backgroundCategorize,
    categorizeSingleTask,
  };
}

export type TasksApi = ReturnType<typeof useTasks>;
