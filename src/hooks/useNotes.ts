import { useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { encrypt, decrypt } from "../lib/encryption";
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
    fetchNotes,
    createNote,
    updateNote,
    deleteNote,
  };
}

export type NotesApi = ReturnType<typeof useNotes>;
