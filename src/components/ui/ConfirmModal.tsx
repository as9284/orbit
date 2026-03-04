import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  icon?: ReactNode;
  variant?: "danger" | "default";
}

export function ConfirmModal({
  open,
  onClose,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  icon,
  variant = "danger",
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              variant === "danger"
                ? "bg-red-500/10 border border-red-500/20"
                : "bg-violet-500/10 border border-violet-500/20"
            }`}
          >
            {icon ?? (
              <AlertTriangle
                size={16}
                className={
                  variant === "danger" ? "text-red-400" : "text-violet-400"
                }
              />
            )}
          </div>
          <p className="text-xs text-white/45 leading-relaxed pt-1">
            {message}
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-white/40 border border-white/8 rounded-xl hover:bg-white/4 hover:text-white/55 transition-all duration-200 focus-ring"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-xl active:scale-[0.98] transition-all duration-150 focus-ring ${
              variant === "danger"
                ? "bg-red-500 text-white hover:bg-red-600"
                : "bg-linear-to-r from-violet-500 to-blue-500 text-white hover:from-violet-400 hover:to-blue-400 shadow-lg shadow-violet-500/15"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
