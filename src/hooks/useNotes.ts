import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { encrypt, decrypt } from "../lib/encryption";
import { isFeatureReady, getActiveApiKey } from "../lib/ai";
import { categorizeNote } from "../lib/openrouter";
import type { Note } from "../types/database.types";

export interface CreateNoteData {
  title: string;
  content?: string;
}

async function decryptNote(note: Note, key: CryptoKey): Promise<Note> {
  return {
    ...note,
    title: await decrypt(note.title, key),
    content: note.content ? await decrypt(note.content, key) : null,
  };
}

async function decryptNotes(notes: Note[], key: CryptoKey): Promise<Note[]> {
  return Promise.all(notes.map((n) => decryptNote(n, key)));
}

export function useNotes(userId: string, encryptionKey: CryptoKey | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  const categoriesKey = `orbit:note-categories:${userId}`;
  const [categories, setCategories] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`orbit:note-categories:${userId}`) ?? "{}",
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

  // Listen for category-clear events from the settings panel
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ userId: string }>;
      if (ce.detail.userId === userId) setCategories({});
    };
    window.addEventListener("orbit:note-categories:cleared", handler);
    return () =>
      window.removeEventListener("orbit:note-categories:cleared", handler);
  }, [userId]);

  const backgroundCategorize = useCallback(
    async (notesList: Note[]) => {
      if (categorizingRef.current) return;
      if (!isFeatureReady("autoCategorize")) return;
      categorizingRef.current = true;
      setIsCategorizingBackground(true);
      setAiStatus(null);
      try {
        const stored = readStoredCategories();
        const noteIds = new Set(notesList.map((n) => n.id));
        const pruned: Record<string, string> = {};
        for (const [id, cat] of Object.entries(stored)) {
          if (noteIds.has(id)) pruned[id] = cat;
        }
        const uncategorized = notesList.filter((n) => !pruned[n.id]);
        writeStoredCategories(pruned);

        for (const note of uncategorized) {
          if (!categorizingRef.current) break;
          const existingCategories = getExistingCategoryPool(pruned);
          const result = await categorizeNote(
            note.title,
            note.content,
            existingCategories,
          );
          if (result.category) {
            pruned[note.id] = result.category;
            writeStoredCategories(pruned);
            if (result.model) {
              setAiStatus(`Luna via ${result.model}`);
            }
            continue;
          }
          if (result.error) {
            setAiStatus(result.error);
            setError(`Luna categorization failed: ${result.error}`);
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

  const categorizeSingleNote = useCallback(
    async ({
      noteId,
      title,
      content,
    }: {
      noteId: string;
      title: string;
      content?: string | null;
    }) => {
      const apiKey = getActiveApiKey();
      if (!apiKey) {
        return {
          category: null,
          model: null,
          error: "Missing API key — configure one in Settings → Luna.",
        };
      }
      const stored = readStoredCategories();
      const existingCategories = getExistingCategoryPool(stored);
      const result = await categorizeNote(title, content, existingCategories);
      if (result.category) {
        stored[noteId] = result.category;
        writeStoredCategories(stored);
        if (result.model) {
          setAiStatus(`Luna via ${result.model}`);
        }
        return result;
      }
      if (result.error) {
        setAiStatus(result.error);
        setError(`Luna categorization failed: ${result.error}`);
      }
      return result;
    },
    [getExistingCategoryPool, readStoredCategories, writeStoredCategories],
  );

  const fetchNotes = useCallback(async () => {
    if (!encryptionKey) return;
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const decrypted = await decryptNotes(data ?? [], encryptionKey);
    setNotes(decrypted);
    setLoading(false);
  }, [userId, encryptionKey]);

  const createNote = async (data: CreateNoteData): Promise<string | null> => {
    if (!encryptionKey) return null;
    const encTitle = await encrypt(data.title.trim(), encryptionKey);
    const encContent = data.content?.trim()
      ? await encrypt(data.content.trim(), encryptionKey)
      : null;
    const { data: inserted, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        title: encTitle,
        content: encContent,
      })
      .select("id")
      .single();
    if (error) {
      setError(error.message);
      return null;
    }
    await fetchNotes();
    return inserted.id;
  };

  const updateNote = async (
    id: string,
    updates: Partial<CreateNoteData>,
  ): Promise<boolean> => {
    if (!encryptionKey) return false;
    const encTitle = updates.title?.trim()
      ? await encrypt(updates.title.trim(), encryptionKey)
      : undefined;
    const encContent =
      updates.content !== undefined
        ? updates.content?.trim()
          ? await encrypt(updates.content.trim(), encryptionKey)
          : null
        : undefined;
    const { error } = await supabase
      .from("notes")
      .update({
        title: encTitle,
        content: encContent,
      })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    await fetchNotes();
    return true;
  };

  const deleteNote = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return false;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    return true;
  };

  return {
    notes,
    loading,
    error,
    aiStatus,
    categories,
    isCategorizingBackground,
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
    backgroundCategorize,
    categorizeSingleNote,
  };
}

export type NotesApi = ReturnType<typeof useNotes>;
