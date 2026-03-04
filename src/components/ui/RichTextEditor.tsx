import { useRef, useCallback, useEffect } from "react";
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

// ─── Markdown → HTML ─────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMdToHtml(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/~~(.+?)~~/g, "<s>$1</s>");
  return s || "<br>";
}

function markdownToHtml(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  const parts: string[] = [];
  let inUl = false;
  let inOl = false;

  for (const line of lines) {
    const ulMatch = line.match(/^[-*]\s+(.*)/);
    const olMatch = line.match(/^\d+\.\s+(.*)/);

    if (ulMatch) {
      if (inOl) {
        parts.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        parts.push("<ul>");
        inUl = true;
      }
      parts.push(`<li>${inlineMdToHtml(ulMatch[1])}</li>`);
    } else if (olMatch) {
      if (inUl) {
        parts.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        parts.push("<ol>");
        inOl = true;
      }
      parts.push(`<li>${inlineMdToHtml(olMatch[1])}</li>`);
    } else {
      if (inUl) {
        parts.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        parts.push("</ol>");
        inOl = false;
      }
      parts.push(`<div>${inlineMdToHtml(line)}</div>`);
    }
  }

  if (inUl) parts.push("</ul>");
  if (inOl) parts.push("</ol>");
  return parts.join("");
}

// ─── HTML → Markdown ─────────────────────────────────────────────────────────

function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return walkNodes(doc.body).trim();
}

function walkNodes(node: Node): string {
  let out = "";

  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? "";
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;

    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case "strong":
      case "b":
        out += `**${walkNodes(el)}**`;
        break;
      case "em":
      case "i":
        out += `*${walkNodes(el)}*`;
        break;
      case "s":
      case "del":
      case "strike":
        out += `~~${walkNodes(el)}~~`;
        break;
      case "ul":
        for (const li of Array.from(el.children)) {
          if (out && !out.endsWith("\n")) out += "\n";
          out += `- ${walkNodes(li)}`;
        }
        if (out && !out.endsWith("\n")) out += "\n";
        break;
      case "ol": {
        let idx = 1;
        for (const li of Array.from(el.children)) {
          if (out && !out.endsWith("\n")) out += "\n";
          out += `${idx++}. ${walkNodes(li)}`;
        }
        if (out && !out.endsWith("\n")) out += "\n";
        break;
      }
      case "li":
        out += walkNodes(el);
        break;
      case "br":
        out += "\n";
        break;
      case "div":
      case "p":
        if (out && !out.endsWith("\n")) out += "\n";
        out += walkNodes(el);
        break;
      default:
        out += walkNodes(el);
    }
  }

  return out;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Add a description (optional)",
  maxLength = 2000,
  hasError,
}: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalChange = useRef(false);
  const lastMd = useRef(value);

  // Set initial HTML on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync when value changes externally (not from our own input)
  useEffect(() => {
    if (internalChange.current) {
      internalChange.current = false;
      return;
    }
    if (value !== lastMd.current && editorRef.current) {
      editorRef.current.innerHTML = markdownToHtml(value);
      lastMd.current = value;
    }
  }, [value]);

  const syncToParent = useCallback(() => {
    if (!editorRef.current) return;
    const md = htmlToMarkdown(editorRef.current.innerHTML);
    if (maxLength && md.length > maxLength) {
      editorRef.current.innerHTML = markdownToHtml(lastMd.current);
      return;
    }
    lastMd.current = md;
    internalChange.current = true;
    onChange(md);
  }, [onChange, maxLength]);

  const handleFormat = useCallback(
    (fmt: Format) => {
      editorRef.current?.focus();
      switch (fmt) {
        case "bold":
          document.execCommand("bold");
          break;
        case "italic":
          document.execCommand("italic");
          break;
        case "strikethrough":
          document.execCommand("strikethrough");
          break;
        case "ul":
          document.execCommand("insertUnorderedList");
          break;
        case "ol":
          document.execCommand("insertOrderedList");
          break;
      }
      syncToParent();
    },
    [syncToParent],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const isEmpty = !value.trim();

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        hasError
          ? "border-red-500/40"
          : "border-white/8 focus-within:border-violet-500/35"
      } bg-white/4 focus-within:bg-white/6`}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2.5 py-1.5 border-b border-white/6">
        {TOOLBAR.map(({ fmt, icon: Icon, label }) => (
          <button
            key={fmt}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleFormat(fmt)}
            className="p-1.5 rounded-md text-white/30 hover:text-white/70 hover:bg-white/7 transition-all duration-150"
            aria-label={label}
            title={label}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>

      {/* Editable area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={syncToParent}
          onPaste={handlePaste}
          role="textbox"
          aria-multiline="true"
          aria-placeholder={placeholder}
          className="w-full bg-transparent px-3.5 py-3 text-white/85 text-sm outline-none min-h-35 leading-relaxed [&_strong]:font-semibold [&_strong]:text-white [&_b]:font-semibold [&_b]:text-white [&_s]:text-white/40 [&_strike]:text-white/40 [&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-0.5 [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:space-y-0.5"
        />
        {isEmpty && (
          <div
            className="absolute top-3 left-3.5 text-sm text-white/25 pointer-events-none select-none"
            aria-hidden="true"
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
