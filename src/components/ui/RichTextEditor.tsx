import { useRef, useCallback } from "react";
import { Bold, Italic, Strikethrough, List, ListOrdered } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  hasError?: boolean;
}

type Format = "bold" | "italic" | "strikethrough" | "ul" | "ol";

const TOOLBAR: { fmt: Format; icon: typeof Bold; label: string }[] = [
  { fmt: "bold", icon: Bold, label: "Bold" },
  { fmt: "italic", icon: Italic, label: "Italic" },
  { fmt: "strikethrough", icon: Strikethrough, label: "Strikethrough" },
  { fmt: "ul", icon: List, label: "Bullet list" },
  { fmt: "ol", icon: ListOrdered, label: "Numbered list" },
];

function applyFormat(
  textarea: HTMLTextAreaElement,
  fmt: Format,
  value: string,
  onChange: (v: string) => void,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = value.slice(start, end);
  let replacement: string;
  let cursorOffset: number;

  switch (fmt) {
    case "bold":
      replacement = selected ? `**${selected}**` : "**bold**";
      cursorOffset = selected ? replacement.length : 2;
      break;
    case "italic":
      replacement = selected ? `*${selected}*` : "*italic*";
      cursorOffset = selected ? replacement.length : 1;
      break;
    case "strikethrough":
      replacement = selected ? `~~${selected}~~` : "~~text~~";
      cursorOffset = selected ? replacement.length : 2;
      break;
    case "ul": {
      const lines = selected
        ? selected
            .split("\n")
            .map((l) => `- ${l}`)
            .join("\n")
        : "- ";
      const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
      replacement = prefix + lines;
      cursorOffset = replacement.length;
      break;
    }
    case "ol": {
      const lines = selected
        ? selected
            .split("\n")
            .map((l, i) => `${i + 1}. ${l}`)
            .join("\n")
        : "1. ";
      const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
      replacement = prefix + lines;
      cursorOffset = replacement.length;
      break;
    }
  }

  const next = value.slice(0, start) + replacement + value.slice(end);
  onChange(next);

  // Restore focus and cursor position after React re-render
  requestAnimationFrame(() => {
    textarea.focus();
    const pos = selected ? start + cursorOffset : start + cursorOffset;
    textarea.setSelectionRange(pos, pos);
  });
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Add a description (optional)",
  maxLength = 2000,
  hasError,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFormat = useCallback(
    (fmt: Format) => {
      if (!textareaRef.current) return;
      applyFormat(textareaRef.current, fmt, value, onChange);
    },
    [value, onChange],
  );

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        hasError
          ? "border-red-500/40"
          : "border-white/[0.08] focus-within:border-violet-500/35"
      } bg-white/[0.04] focus-within:bg-white/[0.06]`}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2.5 py-1.5 border-b border-white/[0.06]">
        {TOOLBAR.map(({ fmt, icon: Icon, label }) => (
          <button
            key={fmt}
            type="button"
            onClick={() => handleFormat(fmt)}
            className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/[0.07] transition-all duration-150"
            aria-label={label}
            title={label}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={6}
        className="w-full bg-transparent px-3.5 py-3 text-white/85 text-sm placeholder:text-white/25 outline-none resize-none min-h-[140px]"
      />
    </div>
  );
}
