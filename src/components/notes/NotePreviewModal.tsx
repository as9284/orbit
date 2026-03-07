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
  summarizing: boolean;
  summaryOpen: boolean;
  onClose: () => void;
  onEdit: (note: Note) => void;
  onConvert: (note: Note) => void;
  onSummarize: (note: Note) => void;
}

export function NotePreviewModal({
  note,
  converting,
  summarizing,
  summaryOpen,
  onClose,
  onEdit,
  onConvert,
  onSummarize,
}: Props) {
  // Keep a snapshot so content stays visible during the exit animation
  // (when note becomes null, displayNote still holds the last note).
  const [displayNote, setDisplayNote] = useState<Note | null>(note);
  if (note && note !== displayNote) {
    setDisplayNote(note);
  }

  const actionButtons = [
    {
      key: "summarize",
      label: "Summarize",
      hint: "Generate a concise AI summary",
      busy: summarizing,
      onClick: () => displayNote && onSummarize(displayNote),
    },
    {
      key: "convert",
      label: "To task",
      hint: "Turn this note into a task draft",
      busy: converting,
      onClick: () => displayNote && onConvert(displayNote),
    },
  ];

  return (
    <Modal
      open={!!note}
      onClose={onClose}
      title="Note"
      maxWidth="max-w-xl"
      closeOnEscape={!summaryOpen}
      closeOnOverlayClick={!summaryOpen}
    >
      {displayNote && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <FileText
                size={18}
                className="text-violet-400/50 shrink-0 mt-0.5"
              />
              <h3 className="text-lg font-semibold text-white leading-snug flex-1 min-w-0">
                {displayNote.title}
              </h3>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {actionButtons.map((action) => (
                <div key={action.key} className="group relative">
                  <button
                    type="button"
                    disabled={action.busy}
                    onClick={action.onClick}
                    aria-label={action.hint}
                    className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/18 bg-cyan-500/6 px-3 py-1.5 text-[11px] font-semibold text-cyan-50 hover:bg-cyan-500/12 hover:border-cyan-200/35 transition-all duration-150 disabled:opacity-60 disabled:cursor-wait focus-ring"
                  >
                    {action.busy ? (
                      <Spinner size={11} />
                    ) : (
                      <Sparkles size={11} />
                    )}
                    <span className="hidden sm:inline">{action.label}</span>
                  </button>
                  <span className="pointer-events-none absolute top-[calc(100%+8px)] right-0 rounded-lg border border-white/10 bg-orbit-800 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-white/85 shadow-xl shadow-black/50 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150 z-10">
                    {action.hint}
                  </span>
                </div>
              ))}
            </div>
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

          <div className="grid gap-2.5 pt-1 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 text-sm font-medium text-white/40 border border-white/8 rounded-xl hover:bg-white/4 hover:text-white/55 transition-all duration-200 focus-ring"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(displayNote);
              }}
              className="py-2.5 text-sm font-semibold bg-linear-to-r from-violet-500 to-blue-500 text-white rounded-xl hover:from-violet-400 hover:to-blue-400 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/15 focus-ring"
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
