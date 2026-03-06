import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { toast } from "react-hot-toast";
import {
  Send,
  BrainCircuit,
  Trash2,
  Square,
  LoaderCircle,
  User as UserIcon,
  CheckCircle2,
  StickyNote,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { useTasksApi, useNotesApi } from "../components/layout/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import {
  hasApiKey,
  isFeatureReady,
  activeModelSupportsThinking,
} from "../lib/ai";
import {
  buildLunaSystemPrompt,
  streamLunaChat,
  type ChatMessage,
  type CacheInfo,
} from "../lib/openrouter";
import { renderMarkdown } from "../lib/markdown";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  pending?: boolean;
  toolResults?: ToolResult[];
  cacheInfo?: CacheInfo;
}

interface ToolResult {
  tool: string;
  status: "pending" | "success" | "error";
  label: string;
}

let msgId = 0;
function nextId() {
  return `msg-${++msgId}-${Date.now()}`;
}

const CHAT_STORAGE_PREFIX = "orbit:luna:chat";

export function LunaPage() {
  const { user } = useAuth();
  const tasksApi = useTasksApi();
  const notesApi = useNotesApi();

  const chatStorageKey = `${CHAT_STORAGE_PREFIX}:${user?.id ?? "_"}`;

  const [messages, setMessages] = useState<UIMessage[]>(() => {
    try {
      const raw = localStorage.getItem(chatStorageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as UIMessage[];
      // Restore msgId counter to avoid collisions
      for (const m of parsed) {
        const match = m.id.match(/^msg-(\d+)-/);
        if (match) msgId = Math.max(msgId, parseInt(match[1], 10));
      }
      return parsed.map((m) => ({ ...m, pending: false }));
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const activeAssistantMessageIdRef = useRef<string | null>(null);
  const activeAssistantHasOutputRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist messages when not streaming
  useEffect(() => {
    if (messages.some((m) => m.pending)) return;
    if (messages.length === 0) {
      localStorage.removeItem(chatStorageKey);
    } else {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages));
    }
  }, [messages, chatStorageKey]);

  // Re-render when AI settings change
  const [, setAiTick] = useState(0);
  useEffect(() => {
    const handler = () => setAiTick((t) => t + 1);
    window.addEventListener("orbit:ai:changed", handler);
    return () => window.removeEventListener("orbit:ai:changed", handler);
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  const ensureActiveAssistantMessage = useCallback(() => {
    if (activeAssistantMessageIdRef.current) {
      return activeAssistantMessageIdRef.current;
    }

    const id = nextId();
    activeAssistantMessageIdRef.current = id;
    activeAssistantHasOutputRef.current = false;
    setMessages((prev) => [
      ...prev,
      {
        id,
        role: "assistant",
        content: "",
        pending: true,
      },
    ]);
    return id;
  }, []);

  const closeActiveAssistantMessage = useCallback(() => {
    const activeId = activeAssistantMessageIdRef.current;
    if (!activeId) return;

    if (activeAssistantHasOutputRef.current) {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === activeId ? { ...message, pending: false } : message,
        ),
      );
    } else {
      setMessages((prev) => prev.filter((message) => message.id !== activeId));
    }

    activeAssistantMessageIdRef.current = null;
    activeAssistantHasOutputRef.current = false;
  }, []);

  const createToolStatusMessage = useCallback(
    (tool: string, label: string) => {
      const id = nextId();
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "assistant",
          content: "",
          toolResults: [
            {
              tool,
              status: "pending",
              label,
            },
          ],
        },
      ]);
      scrollToBottom();
      return id;
    },
    [scrollToBottom],
  );

  const updateToolStatusMessage = useCallback(
    (messageId: string, result: ToolResult) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === messageId
            ? {
                ...message,
                toolResults: [result],
              }
            : message,
        ),
      );
      scrollToBottom();
    },
    [scrollToBottom],
  );

  const handleSend = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();
      const text = input.trim();
      if (!text || streaming) return;

      const apiKey = hasApiKey();
      if (!apiKey) {
        toast.error("Add your API key in Settings → Luna first");
        return;
      }

      if (!isFeatureReady("lunaChat")) {
        toast.error("Enable Luna chat in Settings → Luna first");
        return;
      }

      const userMsg: UIMessage = {
        id: nextId(),
        role: "user",
        content: text,
      };
      const assistantMsg: UIMessage = {
        id: nextId(),
        role: "assistant",
        content: "",
        pending: true,
      };

      activeAssistantMessageIdRef.current = assistantMsg.id;
      activeAssistantHasOutputRef.current = false;

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setStreaming(true);

      // Build conversation history for the API
      const history: ChatMessage[] = [
        {
          role: "system",
          content: buildLunaSystemPrompt({
            tasks: tasksApi.activeTasks.map((t) => ({
              title: t.title,
              priority: t.priority,
              due_date: t.due_date,
              completed: t.completed,
            })),
            notes: notesApi.notes.map((n) => ({ title: n.title })),
          }),
        },
        // Include previous conversation (excluding pending/tool metadata)
        ...messages
          .filter((m) => m.content.trim())
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        { role: "user" as const, content: text },
      ];

      const controller = new AbortController();
      abortRef.current = controller;

      const shouldThink = thinkingMode && activeModelSupportsThinking();

      await streamLunaChat(
        history,
        "",
        {
          onToken: (token) => {
            const activeId = ensureActiveAssistantMessage();
            activeAssistantHasOutputRef.current = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === activeId ? { ...m, content: m.content + token } : m,
              ),
            );
            scrollToBottom();
          },
          onReasoningToken: (token) => {
            const activeId = ensureActiveAssistantMessage();
            activeAssistantHasOutputRef.current = true;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === activeId
                  ? { ...m, reasoning: (m.reasoning ?? "") + token }
                  : m,
              ),
            );
            scrollToBottom();
          },
          onCacheInfo: (info) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, cacheInfo: info } : m,
              ),
            );
          },
          onToolCall: async (name, args) => {
            closeActiveAssistantMessage();

            if (name === "create_task") {
              const title = String(args.title ?? "Untitled task");
              const description = args.description
                ? String(args.description)
                : undefined;
              const priority = (["low", "medium", "high"] as const).includes(
                args.priority as "low" | "medium" | "high",
              )
                ? (args.priority as "low" | "medium" | "high")
                : "medium";
              const dueDate = args.due_date ? String(args.due_date) : undefined;
              const subTasks = Array.isArray(args.sub_tasks)
                ? (args.sub_tasks as string[]).map((s) => ({
                    title: String(s),
                  }))
                : [];
              const statusId = createToolStatusMessage(
                "create_task",
                `Creating task: ${title}`,
              );

              const taskId = await tasksApi.createTask({
                title,
                description,
                priority,
                due_date: dueDate,
              });
              if (taskId && subTasks.length > 0) {
                await tasksApi.saveSubTasks(taskId, subTasks, []);
              }
              const ok = !!taskId;
              updateToolStatusMessage(statusId, {
                tool: "create_task",
                status: ok ? "success" : "error",
                label: ok ? `Created task: ${title}` : "Failed to create task",
              });
              if (ok) toast.success(`Task created: ${title}`);
              else toast.error("Failed to create task");
              return ok
                ? `Task created successfully: "${title}"`
                : "Failed to create task";
            }

            if (name === "create_note") {
              const title = String(args.title ?? "Untitled note");
              const content = args.content ? String(args.content) : undefined;
              const statusId = createToolStatusMessage(
                "create_note",
                `Making note: ${title}`,
              );
              const noteId = await notesApi.createNote({
                title,
                content,
              });
              const ok = !!noteId;
              updateToolStatusMessage(statusId, {
                tool: "create_note",
                status: ok ? "success" : "error",
                label: ok ? `Created note: ${title}` : "Failed to create note",
              });
              if (ok) toast.success(`Note created: ${title}`);
              else toast.error("Failed to create note");
              return ok
                ? `Note created successfully: "${title}"`
                : "Failed to create note";
            }

            return "Unknown tool";
          },
          onDone: (fullText, reasoning) => {
            const activeId = activeAssistantMessageIdRef.current;
            if (activeId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === activeId
                    ? {
                        ...m,
                        content: fullText || m.content,
                        reasoning: reasoning ?? m.reasoning,
                        pending: false,
                      }
                    : m,
                ),
              );
            }
            activeAssistantMessageIdRef.current = null;
            activeAssistantHasOutputRef.current = false;
            setStreaming(false);
            abortRef.current = null;
            scrollToBottom();
          },
          onError: (error) => {
            const activeId = activeAssistantMessageIdRef.current;
            if (activeId) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === activeId
                    ? {
                        ...m,
                        content: m.content || error,
                        pending: false,
                      }
                    : m,
                ),
              );
            } else {
              setMessages((prev) => [
                ...prev,
                {
                  id: nextId(),
                  role: "assistant",
                  content: error,
                },
              ]);
            }
            activeAssistantMessageIdRef.current = null;
            activeAssistantHasOutputRef.current = false;
            setStreaming(false);
            abortRef.current = null;
          },
        },
        controller.signal,
        shouldThink ? { thinkingEnabled: true } : undefined,
      );
    },
    [
      input,
      streaming,
      messages,
      tasksApi,
      notesApi,
      scrollToBottom,
      thinkingMode,
    ],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    activeAssistantMessageIdRef.current = null;
    activeAssistantHasOutputRef.current = false;
    setStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.pending ? { ...m, pending: false } : m)),
    );
  }, []);

  const handleClear = useCallback(() => {
    if (streaming) handleStop();
    setMessages([]);
    localStorage.removeItem(chatStorageKey);
    inputRef.current?.focus();
  }, [streaming, handleStop, chatStorageKey]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!e.ctrlKey && !e.metaKey) {
          void handleSend();
        }
      }
    },
    [handleSend],
  );

  const hasKey = hasApiKey() && isFeatureReady("lunaChat");

  return (
    <div className="flex flex-col h-[calc(100vh-4rem-env(safe-area-inset-bottom))] md:h-screen animate-fade-in">
      {/* Header */}
      <header className="shrink-0 border-b border-white/6 px-4 sm:px-6 h-18 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
          <BrainCircuit size={16} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white tracking-tight">Luna</h1>
          <p className="text-[10px] text-white/30">Your Orbit AI assistant</p>
        </div>
        {activeModelSupportsThinking() && (
          <button
            onClick={() => setThinkingMode((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 ${
              thinkingMode
                ? "text-amber-400 bg-amber-500/10 border border-amber-500/20"
                : "text-white/30 hover:text-white/60 hover:bg-white/5"
            }`}
            aria-label="Toggle thinking mode"
            title={thinkingMode ? "Thinking mode on" : "Thinking mode off"}
          >
            <Sparkles size={12} />
            Think
          </button>
        )}
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/30 hover:text-white/60 hover:bg-white/5 transition-all duration-200"
            aria-label="Clear chat"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </header>

      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {messages.length === 0 ? (
          <EmptyChat
            hasKey={hasKey}
            onSuggestion={(text) => {
              setInput(text);
              inputRef.current?.focus();
            }}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-1">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} className="h-1" />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-white/6 bg-orbit-950/80 backdrop-blur-sm">
        <form
          onSubmit={handleSend}
          className="max-w-3xl w-full mx-auto px-4 sm:px-6 py-3 flex items-end"
        >
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasKey ? "Message Luna…" : "Enable Luna in Settings → Luna"
              }
              disabled={!hasKey}
              rows={1}
              className="block w-full resize-none bg-white/4 border border-white/8 rounded-xl px-4 py-3 pr-14 text-sm text-white/90 placeholder:text-white/20 outline-none focus:border-violet-500/30 focus:bg-white/6 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed max-h-36 overflow-y-auto"
              style={{
                height: "auto",
                minHeight: "48px",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
              }}
            />
            {streaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-red-500/15 border border-red-500/20 text-red-400 hover:bg-red-500/25 transition-all duration-200"
                aria-label="Stop generating"
              >
                <Square size={13} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim() || !hasKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-lg bg-linear-to-r from-violet-500 to-blue-500 text-white shadow-md shadow-violet-500/20 hover:from-violet-400 hover:to-blue-400 active:scale-95 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:from-violet-500 disabled:hover:to-blue-500 disabled:active:scale-100"
                aria-label="Send message"
              >
                <Send size={14} />
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const hasToolResults = !!message.toolResults?.length;
  const showTextBubble =
    isUser || !!message.content || (!hasToolResults && message.pending);

  return (
    <div
      className={`flex gap-3 py-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg bg-violet-500/15 border border-violet-500/20 flex items-center justify-center mt-0.5">
          <BrainCircuit size={13} className="text-violet-400" />
        </div>
      )}

      <div
        className={`min-w-0 max-w-[85%] sm:max-w-[75%] ${isUser ? "order-first" : ""}`}
      >
        {/* Reasoning (thinking) collapsible */}
        {!isUser && message.reasoning && (
          <div className="mb-2">
            <button
              onClick={() => setReasoningOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-amber-400/70 hover:text-amber-400 bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/20 transition-all duration-200"
            >
              <Sparkles size={11} />
              Thinking
              <ChevronDown
                size={11}
                className={`transition-transform duration-200 ${reasoningOpen ? "rotate-180" : ""}`}
              />
            </button>
            {reasoningOpen && (
              <div className="mt-1.5 rounded-xl bg-amber-500/5 border border-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200/50 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                {message.reasoning}
              </div>
            )}
          </div>
        )}

        {showTextBubble && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "bg-violet-500/20 border border-violet-500/15 text-white/90 rounded-br-md"
                : "bg-white/4 border border-white/7 text-white/80 rounded-bl-md"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap wrap-break-word">
                {message.content}
              </p>
            ) : message.content ? (
              <div className="prose-luna">
                {renderMarkdown(message.content)}
              </div>
            ) : message.pending ? (
              <div className="flex items-center gap-1.5 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Tool call results */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {message.toolResults.map((tr, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
                  tr.status === "success"
                    ? "bg-emerald-500/8 border-emerald-500/15 text-emerald-400/90"
                    : tr.status === "error"
                      ? "bg-red-500/8 border-red-500/15 text-red-400/90"
                      : "bg-white/4 border-white/10 text-white/65"
                }`}
              >
                {tr.status === "pending" ? (
                  <LoaderCircle size={12} className="animate-spin" />
                ) : tr.tool === "create_task" ? (
                  <CheckCircle2 size={12} />
                ) : (
                  <StickyNote size={12} />
                )}
                {tr.label}
              </div>
            ))}
          </div>
        )}

        {/* Cache info */}
        {message.cacheInfo &&
          (message.cacheInfo.cacheHitTokens > 0 ||
            message.cacheInfo.cacheMissTokens > 0) && (
            <div className="mt-1.5 px-3 py-1 text-[10px] text-white/20">
              Cache: {message.cacheInfo.cacheHitTokens} hit /{" "}
              {message.cacheInfo.cacheMissTokens} miss tokens
            </div>
          )}
      </div>

      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg bg-white/7 border border-white/10 flex items-center justify-center mt-0.5">
          <UserIcon size={13} className="text-white/40" />
        </div>
      )}
    </div>
  );
}

function EmptyChat({
  hasKey,
  onSuggestion,
}: {
  hasKey: boolean;
  onSuggestion: (text: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center mb-6">
        <BrainCircuit size={28} className="text-violet-400/60" />
      </div>
      <h2 className="text-lg font-bold text-white/80 mb-2">Chat with Luna</h2>
      <p className="text-sm text-white/30 max-w-sm leading-relaxed mb-6">
        {hasKey
          ? "Luna knows about your tasks and notes. Ask questions, get advice, or have Luna create tasks and notes for you."
          : "Enable Luna chat and add an API key in Settings → Luna to start chatting."}
      </p>
      {hasKey && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
          {[
            "What tasks should I focus on today?",
            "Create a task to review project docs",
            "Summarize my current notes",
            "Write a note with ideas for the weekend",
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => onSuggestion(suggestion)}
              className="text-left px-3.5 py-2.5 rounded-xl border border-white/7 bg-white/2.5 text-xs text-white/40 hover:text-white/65 hover:bg-white/5 hover:border-white/12 transition-all duration-200"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
