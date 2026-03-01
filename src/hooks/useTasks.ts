import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type { Task } from "../types/database.types";

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  due_date?: string | null;
}

export function useTasks(userId: string) {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [loadingActive, setLoadingActive] = useState(false);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveTasks = useCallback(async () => {
    setLoadingActive(true);
    setError(null);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("created_at", { ascending: false });
    setLoadingActive(false);
    if (error) {
      setError(error.message);
      return;
    }
    setActiveTasks(data ?? []);
  }, [userId]);

  const fetchArchivedTasks = useCallback(async () => {
    setLoadingArchived(true);
    setError(null);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", true)
      .order("archived_at", { ascending: false });
    setLoadingArchived(false);
    if (error) {
      setError(error.message);
      return;
    }
    setArchivedTasks(data ?? []);
  }, [userId]);

  const createTask = async (data: CreateTaskData): Promise<boolean> => {
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: data.title.trim(),
      description: data.description?.trim() || null,
      priority: data.priority ?? "medium",
      due_date: data.due_date || null,
    });
    if (error) {
      setError(error.message);
      return false;
    }
    await fetchActiveTasks();
    return true;
  };

  const updateTask = async (
    id: string,
    updates: Partial<CreateTaskData>,
  ): Promise<boolean> => {
    const { error } = await supabase
      .from("tasks")
      .update({
        title: updates.title?.trim(),
        description: updates.description?.trim() || null,
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
  };
}

export type TasksApi = ReturnType<typeof useTasks>;
