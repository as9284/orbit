import { useState } from "react";
import { FileText, Pencil, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";
import { renderMarkdown } from "../../lib/markdown";
import type { Note } from "../../types/database.types";

interface Props {
  note: Note | null;
  converting: boolean;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onConvert: (note: Note) => void;
}

export function NotePreviewModal({
  note,
  converting,
  onClose,
  onEdit,
  onConvert,
}: Props) {
  // Keep a snapshot so content stays visible during the exit animation
  // (when note becomes null, displayNote still holds the last note).
  const [displayNote, setDisplayNote] = useState<Note | null>(note);
  if (note && note !== displayNote) {
    setDisplayNote(note);
  }

  return (
    <Modal open={!!note} onClose={onClose} title="Note" maxWidth="max-w-xl">
      {displayNote && (
        <div className="space-y-5">
          <div className="flex items-start gap-3">
            <FileText
              size={18}
              className="text-violet-400/50 shrink-0 mt-0.5"
            />
            <h3 className="text-lg font-semibold text-white leading-snug flex-1">
              {displayNote.title}
            </h3>
          </div>

          {displayNote.content && (
            <div className="bg-white/3 border border-white/6 rounded-xl px-4 py-3 text-sm text-white/70 leading-relaxed space-y-1.5">
              {renderMarkdown(displayNote.content)}
            </div>
          )}

          <div className="pt-2 border-t border-white/6 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-[11px] text-white/20">
            <span>
              Created{" "}
              {format(
                parseISO(displayNote.created_at),
                "MMM d, yyyy 'at' h:mm a",
              )}
            </span>
            <span>
              Updated{" "}
              {format(
                parseISO(displayNote.updated_at),
                "MMM d, yyyy 'at' h:mm a",
              )}
            </span>
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-white/40 border border-white/8 rounded-xl hover:bg-white/4 hover:text-white/55 transition-all duration-200 focus-ring"
            >
              Close
            </button>
            <button
              type="button"
              disabled={converting}
              onClick={() => onConvert(displayNote)}
              className="flex-1 py-2.5 text-sm font-semibold border border-cyan-400/20 text-cyan-100 rounded-xl hover:bg-cyan-500/10 hover:border-cyan-300/35 transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait focus-ring"
            >
              {converting ? <Spinner size={13} /> : <Sparkles size={13} />}
              Luna to task
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(displayNote);
              }}
              className="flex-1 py-2.5 text-sm font-semibold bg-linear-to-r from-violet-500 to-blue-500 text-white rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/15 focus-ring"
            >
              <Pencil size={13} />
              Edit note
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
