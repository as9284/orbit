import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  PenLine,
  Copy,
  Check,
  ArrowRight,
  Eraser,
  Loader2,
} from "lucide-react";
import { isFeatureReady } from "../lib/ai";
import { processWriting, type WritingMode } from "../lib/openrouter";
import { useAuth } from "../contexts/AuthContext";

interface ModeOption {
  mode: WritingMode;
  label: string;
  description: string;
}

const MODES: ModeOption[] = [
  {
    mode: "improve",
    label: "Improve",
    description: "Enhance clarity and quality",
  },
  {
    mode: "grammar",
    label: "Fix Grammar",
    description: "Correct errors and polish",
  },
  {
    mode: "rephrase",
    label: "Rephrase",
    description: "Say it a different way",
  },
  {
    mode: "formal",
    label: "Make Formal",
    description: "Professional & polished tone",
  },
  {
    mode: "casual",
    label: "Make Casual",
    description: "Friendly & conversational",
  },
  {
    mode: "expand",
    label: "Expand",
    description: "Add more detail and context",
  },
  { mode: "shorten", label: "Shorten", description: "Make it more concise" },
  {
    mode: "bullets",
    label: "Bullet Points",
    description: "Convert to a bullet list",
  },
  {
    mode: "continue",
    label: "Continue",
    description: "Keep writing in the same style",
  },
  {
    mode: "email",
    label: "Format as Email",
    description:
      "Reformat as a formal, professional email with greeting and signature",
  },
];

export function WritingAssistantPage() {
  const { user } = useAuth();
  const userName: string = user?.user_metadata?.full_name ?? user?.email ?? "";
  const [input, setInput] = useState(
    () => sessionStorage.getItem("orbit:writing:input") ?? "",
  );
  const [output, setOutput] = useState(
    () => sessionStorage.getItem("orbit:writing:output") ?? "",
  );
  const [activeMode, setActiveMode] = useState<WritingMode>(
    () =>
      (sessionStorage.getItem("orbit:writing:mode") as WritingMode | null) ??
      "improve",
  );
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const outputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sessionStorage.setItem("orbit:writing:input", input);
  }, [input]);

  useEffect(() => {
    sessionStorage.setItem("orbit:writing:output", output);
  }, [output]);

  useEffect(() => {
    sessionStorage.setItem("orbit:writing:mode", activeMode);
  }, [activeMode]);

  const handleProcess = useCallback(async () => {
    if (!input.trim()) {
      toast.error("Please enter some text first");
      return;
    }

    if (!isFeatureReady("writingAssistant")) {
      toast.error("Enable Writing Assistant in Settings → Luna first");
      return;
    }

    setLoading(true);
    setOutput("");

    try {
      const result = await processWriting(
        input,
        activeMode,
        activeMode === "email" ? userName : undefined,
      );
      if (!result.text) {
        toast.error(result.error ?? "Luna couldn't process your text");
        return;
      }
      setOutput(result.text);
    } finally {
      setLoading(false);
    }
  }, [input, activeMode]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [output]);

  const handleUseOutput = useCallback(() => {
    if (!output) return;
    setInput(output);
    setOutput("");
    toast.success("Output moved to input");
  }, [output]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
  }, []);

  const featureReady = isFeatureReady("writingAssistant");

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-400/20 flex items-center justify-center">
            <PenLine size={15} className="text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white/90">
              Writing Assistant
            </h1>
            <p className="text-[11px] text-white/35">
              AI-powered text transformation
            </p>
          </div>
        </div>
        {input.trim() && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 text-[11px] text-white/30 hover:text-white/60 transition-colors"
          >
            <Eraser size={12} />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-0">
        {/* Left column — input + modes */}
        <div className="flex flex-col flex-1 min-h-0 border-r border-white/6">
          {/* Mode selector */}
          <div className="px-4 pt-3 pb-2 border-b border-white/5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">
              Mode
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map(({ mode, label, description }) => (
                <button
                  key={mode}
                  type="button"
                  title={description}
                  onClick={() => setActiveMode(mode)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-150 border ${
                    activeMode === mode
                      ? "bg-violet-500/18 border-violet-400/30 text-violet-300"
                      : "bg-white/3 border-white/7 text-white/45 hover:text-white/70 hover:bg-white/6 hover:border-white/12"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Text input */}
          <div className="flex flex-col flex-1 min-h-0 p-4 gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste or type your text here…"
              className="flex-1 min-h-0 w-full resize-none bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white/85 placeholder-white/20 focus:outline-none focus:border-violet-400/35 focus:bg-white/5 transition-all duration-200 leading-relaxed"
            />

            {/* Process button */}
            <button
              type="button"
              onClick={handleProcess}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-linear-to-r from-violet-500 to-blue-500 text-white hover:opacity-90 shadow-sm shadow-violet-500/20"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  {MODES.find((m) => m.mode === activeMode)?.label}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right column — output */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/5 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
              Result
            </p>
            {output && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleUseOutput}
                  title="Move result back to input"
                  className="flex items-center gap-1 text-[11px] text-white/35 hover:text-violet-400 transition-colors px-2 py-1 rounded-lg hover:bg-violet-500/8"
                >
                  <ArrowRight size={11} className="rotate-180" />
                  Use as input
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] text-white/35 hover:text-white/70 transition-colors px-2 py-1 rounded-lg hover:bg-white/6"
                >
                  {copied ? (
                    <Check size={11} className="text-emerald-400" />
                  ) : (
                    <Copy size={11} />
                  )}
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 p-4">
            {output ? (
              <textarea
                ref={outputRef}
                readOnly
                value={output}
                className="h-full w-full resize-none bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white/85 focus:outline-none leading-relaxed"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                {loading ? (
                  <>
                    <Loader2
                      size={22}
                      className="animate-spin text-violet-400/60"
                    />
                    <p className="text-xs text-white/30">Luna is writing…</p>
                  </>
                ) : !featureReady ? (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-white/4 border border-white/7 flex items-center justify-center">
                      <PenLine size={18} className="text-white/20" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white/40">
                        Writing Assistant is disabled
                      </p>
                      <p className="text-[11px] text-white/20 mt-0.5">
                        Enable it in Settings → Luna
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-white/4 border border-white/7 flex items-center justify-center">
                      <PenLine size={18} className="text-white/20" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-white/40">
                        Your result will appear here
                      </p>
                      <p className="text-[11px] text-white/20 mt-0.5">
                        Enter text, choose a mode, and tap the button
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
