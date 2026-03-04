import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import { RichTextEditor } from "../ui/RichTextEditor";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (title: string, content: string) => Promise<boolean>;
}

export function CreateNoteModal({ open, onClose, onCreate }: Props) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titleError, setTitleError] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setTitle("");
    setContent("");
    setTitleError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setTitleError("Note title is required");
      return;
    }
    if (title.trim().length > 200) {
      setTitleError("Title cannot exceed 200 characters");
      return;
    }
    setLoading(true);
    const ok = await onCreate(title, content);
    setLoading(false);
    if (ok) handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="New note">
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
            onClick={handleClose}
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
            Create note
          </button>
        </div>
      </form>
    </Modal>
  );
}
