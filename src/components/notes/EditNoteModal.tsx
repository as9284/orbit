import { useState, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import { RichTextEditor } from "../ui/RichTextEditor";
import type { Note } from "../../types/database.types";

interface Props {
  open: boolean;
  note: Note | null;
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => Promise<boolean>;
}

export function EditNoteModal({ open, note, onClose, onSave }: Props) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [titleError, setTitleError] = useState("");
  const [loading, setLoading] = useState(false);

  // Sync form state whenever a different note is selected for editing.
  // Guarded by `if (note)` so form content persists during the exit animation
  // (when note becomes null but the modal is still animating out).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content ?? "");
      setTitleError("");
    }
  }, [note?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) return;
    if (!title.trim()) {
      setTitleError("Note title is required");
      return;
    }
    if (title.trim().length > 200) {
      setTitleError("Title cannot exceed 200 characters");
      return;
    }
    setLoading(true);
    const ok = await onSave(note.id, title, content);
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit note">
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <input
            type="text"
            autoFocus
            placeholder="Note title"
            value={title}
            maxLength={200}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleError("");
            }}
            className={`w-full bg-transparent text-white text-base font-medium placeholder:text-white/25 outline-none border-b pb-2.5 transition-colors duration-200 ${
              titleError
                ? "border-red-500/40"
                : "border-white/9 focus:border-violet-500/40"
            }`}
          />
          {titleError && (
            <p className="mt-1.5 text-[11px] text-red-400">{titleError}</p>
          )}
        </div>
        <div>
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Write your note…"
            maxLength={10000}
          />
        </div>
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-white/40 border border-white/8 rounded-xl hover:bg-white/4 hover:text-white/55 transition-all duration-200 focus-ring"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-semibold bg-linear-to-r from-violet-500 to-blue-500 text-white rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/15 focus-ring"
          >
            {loading && <Spinner size={13} className="text-white" />}
            Save changes
          </button>
        </div>
      </form>
    </Modal>
  );
}
