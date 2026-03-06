import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { encrypt, decrypt } from "../lib/encryption";
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
    setActiveTasks(decrypted);
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
    const { error } = await supabase
      .from("tasks")
      .update({ completed })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    setActiveTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed } : t)),
    );
    return true;
  };

  const archiveTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("tasks")
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    setActiveTasks((prev) => prev.filter((t) => t.id !== id));
    return true;
  };

  const unarchiveTask = async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from("tasks")
      .update({ archived: false, archived_at: null })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    setArchivedTasks((prev) => prev.filter((t) => t.id !== id));
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
  };
}

export type TasksApi = ReturnType<typeof useTasks>;
