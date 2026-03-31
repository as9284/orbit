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
  Archive,
  ArchiveRestore,
  PenLine,
  Video,
  RefreshCw,
  FolderOpen,
  Unlink,
  ListChecks,
} from "lucide-react";
import { useTasksApi, useNotesApi } from "../components/layout/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import { useMeetingSessions } from "../hooks/useMeetingSessions";
import { useProjects } from "../hooks/useProjects";

import {
  hasApiKey,
  isFeatureReady,
  activeModelSupportsThinking,
  getAiSettings,
} from "../lib/ai";
import {
  buildLunaSystemPrompt,
  streamLunaChat,
  processWriting,
  type ChatMessage,
  type CacheInfo,
  type WritingMode,
} from "../lib/openrouter";
import { renderMarkdown } from "../lib/markdown";

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  thinkingFallback?: boolean;
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
  const { user, encryptionKey } = useAuth();
  const tasksApi = useTasksApi();
  const notesApi = useNotesApi();
  const projectsApi = useProjects(user!.id);
  const meetingApi = useMeetingSessions(user?.id);
  const { activeSession, sessions: meetingSessions } = meetingApi;
  const userName: string = user?.user_metadata?.full_name ?? user?.email ?? "";

  // Fetch archived tasks so Luna can reference & unarchive them
  useEffect(() => {
    if (encryptionKey) tasksApi.fetchArchivedTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encryptionKey]);

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
  const thinkingFallbackRef = useRef(false);
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

  // Ensure tasks and notes are loaded when Luna is opened directly
  // (they are lazy-loaded by their respective pages otherwise)
  useEffect(() => {
    if (!encryptionKey) return;
    if (tasksApi.activeTasks.length === 0) tasksApi.fetchActiveTasks();
    if (notesApi.notes.length === 0) void notesApi.fetchNotes();
  }, [encryptionKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
        thinkingFallback: thinkingFallbackRef.current,
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

  const waitForNextPaint = useCallback(
    () =>
      new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    [],
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
        thinkingFallback: false,
        pending: true,
      };

      activeAssistantMessageIdRef.current = assistantMsg.id;
      activeAssistantHasOutputRef.current = false;
      thinkingFallbackRef.current = false;

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setStreaming(true);

      // Build conversation history for the API
      // Fetch sub-tasks for active tasks so Luna sees the full picture
      const tasksWithSubTasks = await Promise.all(
        tasksApi.activeTasks.map(async (t) => {
          const subTasks = await tasksApi.fetchSubTasks(t.id);
          return {
            title: t.title,
            description: t.description,
            priority: t.priority,
            due_date: t.due_date,
            completed: t.completed,
            subTasks: subTasks.map((st) => ({
              title: st.title,
              completed: st.completed,
            })),
          };
        }),
      );

      const history: ChatMessage[] = [
        {
          role: "system",
          content: buildLunaSystemPrompt({
            tasks: tasksWithSubTasks,
            archivedTasks: tasksApi.archivedTasks.map((t) => ({
              title: t.title,
              description: t.description,
              priority: t.priority,
              completed: t.completed,
            })),
            notes: notesApi.notes.map((n) => ({
              title: n.title,
              content: n.content,
              updated_at: n.updated_at,
            })),
            projects: projectsApi.projects.map((p) => ({
              id: p.id,
              name: p.name,
              description: p.description,
              deadline: p.deadline,
              taskIds: p.taskIds,
              noteIds: p.noteIds,
            })),
            meetingSessions: {
              active: activeSession
                ? {
                    title: activeSession.title,
                    startedAt: activeSession.startedAt,
                    entries: activeSession.entries.map((e) => ({
                      content: e.content,
                      createdAt: e.createdAt,
                    })),
                  }
                : null,
              completed: meetingSessions.map((s) => ({
                title: s.title,
                endedAt: s.endedAt,
                artifactNote: s.artifacts?.note.title ?? null,
                artifactTask: s.artifacts?.task.title ?? null,
              })),
            },
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

      // Gemini always thinks automatically; for other providers respect the toggle
      const isGeminiProvider = getAiSettings().provider === "gemini";
      const shouldThink =
        isGeminiProvider || (thinkingMode && activeModelSupportsThinking());

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
          onThinkingFallback: () => {
            thinkingFallbackRef.current = true;
            const activeId = ensureActiveAssistantMessage();
            setMessages((prev) =>
              prev.map((m) =>
                m.id === activeId ? { ...m, thinkingFallback: true } : m,
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
              const taskProjectName = args.project_name
                ? String(args.project_name)
                : undefined;
              const statusId = createToolStatusMessage(
                "create_task",
                `Creating task: ${title}`,
              );
              await waitForNextPaint();

              const taskId = await tasksApi.createTask({
                title,
                description,
                priority,
                due_date: dueDate,
              });
              if (taskId && subTasks.length > 0) {
                await tasksApi.saveSubTasks(taskId, subTasks, []);
              }
              if (taskId && taskProjectName) {
                const proj =
                  projectsApi.projects.find(
                    (p) =>
                      p.name.toLowerCase() === taskProjectName.toLowerCase(),
                  ) ??
                  projectsApi.projects.find((p) =>
                    p.name
                      .toLowerCase()
                      .includes(taskProjectName.toLowerCase()),
                  );
                if (proj) projectsApi.linkTask(proj.id, taskId);
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
                ? `Task created successfully: "${title}"${
                    taskProjectName
                      ? ` (linked to project "${taskProjectName}")`
                      : ""
                  }`
                : "Failed to create task";
            }

            if (name === "create_note") {
              const title = String(args.title ?? "Untitled note");
              const content = args.content ? String(args.content) : undefined;
              const noteProjectName = args.project_name
                ? String(args.project_name)
                : undefined;
              const statusId = createToolStatusMessage(
                "create_note",
                `Making note: ${title}`,
              );
              await waitForNextPaint();
              const noteId = await notesApi.createNote({
                title,
                content,
              });
              if (noteId && noteProjectName) {
                const proj =
                  projectsApi.projects.find(
                    (p) =>
                      p.name.toLowerCase() === noteProjectName.toLowerCase(),
                  ) ??
                  projectsApi.projects.find((p) =>
                    p.name
                      .toLowerCase()
                      .includes(noteProjectName.toLowerCase()),
                  );
                if (proj) projectsApi.linkNote(proj.id, noteId);
              }
              const ok = !!noteId;
              updateToolStatusMessage(statusId, {
                tool: "create_note",
                status: ok ? "success" : "error",
                label: ok ? `Created note: ${title}` : "Failed to create note",
              });
              if (ok) toast.success(`Note created: ${title}`);
              else toast.error("Failed to create note");
              return ok
                ? `Note created successfully: "${title}"${
                    noteProjectName
                      ? ` (linked to project "${noteProjectName}")`
                      : ""
                  }`
                : "Failed to create note";
            }

            if (name === "archive_task") {
              const taskTitle = String(args.task_title ?? "");
              const match =
                tasksApi.activeTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.activeTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              if (!match) {
                return `Could not find an active task matching "${taskTitle}"`;
              }
              const statusId = createToolStatusMessage(
                "archive_task",
                `Archiving: ${match.title}`,
              );
              await waitForNextPaint();
              const ok = await tasksApi.archiveTask(match.id);
              updateToolStatusMessage(statusId, {
                tool: "archive_task",
                status: ok ? "success" : "error",
                label: ok
                  ? `Archived task: ${match.title}`
                  : "Failed to archive task",
              });
              if (ok) toast.success(`Task archived: ${match.title}`);
              else toast.error("Failed to archive task");
              return ok
                ? `Task archived: "${match.title}"`
                : "Failed to archive task";
            }

            if (name === "complete_task") {
              const taskTitle = String(args.task_title ?? "");
              const match =
                tasksApi.activeTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.activeTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              if (!match) {
                return `Could not find an active task matching "${taskTitle}"`;
              }
              const statusId = createToolStatusMessage(
                "complete_task",
                `Completing: ${match.title}`,
              );
              await waitForNextPaint();
              const ok = await tasksApi.toggleComplete(match.id, true);
              updateToolStatusMessage(statusId, {
                tool: "complete_task",
                status: ok ? "success" : "error",
                label: ok
                  ? `Completed task: ${match.title}`
                  : "Failed to complete task",
              });
              if (ok) toast.success(`Task completed: ${match.title}`);
              else toast.error("Failed to complete task");
              return ok
                ? `Task marked complete: "${match.title}"`
                : "Failed to complete task";
            }

            if (name === "delete_note") {
              const noteTitle = String(args.note_title ?? "");
              const match =
                notesApi.notes.find(
                  (n) => n.title.toLowerCase() === noteTitle.toLowerCase(),
                ) ??
                notesApi.notes.find((n) =>
                  n.title.toLowerCase().includes(noteTitle.toLowerCase()),
                );
              if (!match) {
                return `Could not find a note matching "${noteTitle}"`;
              }
              const statusId = createToolStatusMessage(
                "delete_note",
                `Deleting note: ${match.title}`,
              );
              await waitForNextPaint();
              const ok = await notesApi.deleteNote(match.id);
              updateToolStatusMessage(statusId, {
                tool: "delete_note",
                status: ok ? "success" : "error",
                label: ok
                  ? `Deleted note: ${match.title}`
                  : "Failed to delete note",
              });
              if (ok) toast.success(`Note deleted: ${match.title}`);
              else toast.error("Failed to delete note");
              return ok
                ? `Note deleted: "${match.title}"`
                : "Failed to delete note";
            }

            if (name === "transform_text") {
              const text = String(args.text ?? "");
              const mode = String(args.mode ?? "improve") as WritingMode;
              if (!text.trim()) return "No text provided to transform.";
              const statusId = createToolStatusMessage(
                "transform_text",
                `Applying ${mode} transformation…`,
              );
              await waitForNextPaint();
              const result = await processWriting(
                text,
                mode,
                mode === "email" ? userName : undefined,
              );
              if (result.text) {
                updateToolStatusMessage(statusId, {
                  tool: "transform_text",
                  status: "success",
                  label: `Text transformed (${mode})`,
                });
                return `Transformed text:\n\n${result.text}`;
              } else {
                updateToolStatusMessage(statusId, {
                  tool: "transform_text",
                  status: "error",
                  label: "Text transformation failed",
                });
                return result.error ?? "Failed to transform text.";
              }
            }

            if (name === "start_meeting") {
              const title = String(args.title ?? "Meeting");
              if (meetingApi.activeSession) {
                return `A meeting session is already active: "${meetingApi.activeSession.title}". End it first.`;
              }
              const statusId = createToolStatusMessage(
                "start_meeting",
                `Starting meeting: ${title}`,
              );
              await waitForNextPaint();
              const session = meetingApi.startSession(title);
              const ok = !!session;
              updateToolStatusMessage(statusId, {
                tool: "start_meeting",
                status: ok ? "success" : "error",
                label: ok
                  ? `Meeting started: ${title}`
                  : "Failed to start meeting",
              });
              if (ok) toast.success(`Meeting started: ${title}`);
              return ok
                ? `Meeting session started: "${title}"`
                : "Failed to start meeting session.";
            }

            if (name === "add_meeting_entry") {
              const content = String(args.content ?? "");
              if (!content.trim())
                return "No content provided for meeting entry.";
              if (!meetingApi.activeSession) {
                return "No active meeting session. Start one first with start_meeting.";
              }
              const statusId = createToolStatusMessage(
                "add_meeting_entry",
                `Adding meeting entry…`,
              );
              await waitForNextPaint();
              const ok = meetingApi.addEntry(content);
              updateToolStatusMessage(statusId, {
                tool: "add_meeting_entry",
                status: ok ? "success" : "error",
                label: ok ? "Meeting entry added" : "Failed to add entry",
              });
              return ok
                ? `Meeting entry added: "${content.slice(0, 80)}${content.length > 80 ? "…" : ""}"`
                : "Failed to add meeting entry.";
            }

            if (name === "end_meeting") {
              if (!meetingApi.activeSession) {
                return "No active meeting session to end.";
              }
              const title = meetingApi.activeSession.title;
              const statusId = createToolStatusMessage(
                "end_meeting",
                `Ending meeting: ${title}`,
              );
              await waitForNextPaint();
              const ok = meetingApi.discardActiveSession();
              updateToolStatusMessage(statusId, {
                tool: "end_meeting",
                status: ok ? "success" : "error",
                label: ok ? `Meeting ended: ${title}` : "Failed to end meeting",
              });
              if (ok) toast.success(`Meeting ended: ${title}`);
              return ok
                ? `Meeting session ended: "${title}"`
                : "Failed to end meeting session.";
            }

            if (name === "recategorize_tasks") {
              const statusId = createToolStatusMessage(
                "recategorize_tasks",
                "Regenerating task categories…",
              );
              await waitForNextPaint();
              const userId = user!.id;
              localStorage.removeItem(`orbit:categories:${userId}`);
              window.dispatchEvent(
                new CustomEvent("orbit:categories:cleared", {
                  detail: { userId },
                }),
              );
              await waitForNextPaint();
              void tasksApi.backgroundCategorize(tasksApi.activeTasks);
              updateToolStatusMessage(statusId, {
                tool: "recategorize_tasks",
                status: "success",
                label: "Task categories cleared — regenerating in background",
              });
              toast.success("Task categories are being regenerated");
              return "Task categories have been cleared and are being regenerated in the background.";
            }

            if (name === "recategorize_notes") {
              const statusId = createToolStatusMessage(
                "recategorize_notes",
                "Regenerating note categories…",
              );
              await waitForNextPaint();
              const userId = user!.id;
              localStorage.removeItem(`orbit:note-categories:${userId}`);
              window.dispatchEvent(
                new CustomEvent("orbit:note-categories:cleared", {
                  detail: { userId },
                }),
              );
              await waitForNextPaint();
              void notesApi.backgroundCategorize(notesApi.notes);
              updateToolStatusMessage(statusId, {
                tool: "recategorize_notes",
                status: "success",
                label: "Note categories cleared — regenerating in background",
              });
              toast.success("Note categories are being regenerated");
              return "Note categories have been cleared and are being regenerated in the background.";
            }

            if (name === "update_task") {
              const taskTitle = String(args.task_title ?? "");
              const match =
                tasksApi.activeTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.activeTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              if (!match) {
                return `Could not find an active task matching "${taskTitle}"`;
              }
              const updates: {
                title?: string;
                description?: string;
                priority?: "low" | "medium" | "high";
                due_date?: string | null;
              } = {};
              if (args.new_title) updates.title = String(args.new_title);
              if (args.description !== undefined)
                updates.description = String(args.description);
              if (
                args.priority === "low" ||
                args.priority === "medium" ||
                args.priority === "high"
              )
                updates.priority = args.priority;
              if (args.due_date !== undefined)
                updates.due_date =
                  args.due_date === "" ? null : String(args.due_date);
              const statusId = createToolStatusMessage(
                "update_task",
                `Updating task: ${match.title}`,
              );
              await waitForNextPaint();
              const ok = await tasksApi.updateTask(match.id, updates);
              updateToolStatusMessage(statusId, {
                tool: "update_task",
                status: ok ? "success" : "error",
                label: ok
                  ? `Updated task: ${updates.title ?? match.title}`
                  : "Failed to update task",
              });
              if (ok)
                toast.success(`Task updated: ${updates.title ?? match.title}`);
              else toast.error("Failed to update task");
              return ok
                ? `Task updated: "${updates.title ?? match.title}"`
                : "Failed to update task";
            }

            if (name === "add_subtasks") {
              const taskTitle = String(args.task_title ?? "");
              const newSubTasks = Array.isArray(args.sub_tasks)
                ? (args.sub_tasks as string[]).map((s) => String(s))
                : [];
              if (newSubTasks.length === 0) {
                return "No sub-tasks provided.";
              }
              const match =
                tasksApi.activeTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.activeTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              if (!match) {
                return `Could not find an active task matching "${taskTitle}"`;
              }
              const statusId = createToolStatusMessage(
                "add_subtasks",
                `Adding ${newSubTasks.length} sub-task(s) to: ${match.title}`,
              );
              await waitForNextPaint();
              // Fetch existing sub-tasks to preserve them
              const existing = await tasksApi.fetchSubTasks(match.id);
              const existingIds = existing.map((st) => st.id);
              const merged = [
                ...existing.map((st) => ({
                  id: st.id,
                  title: st.title,
                  completed: st.completed,
                })),
                ...newSubTasks.map((title) => ({ title, completed: false })),
              ];
              const ok = await tasksApi.saveSubTasks(
                match.id,
                merged,
                existingIds,
              );
              updateToolStatusMessage(statusId, {
                tool: "add_subtasks",
                status: ok ? "success" : "error",
                label: ok
                  ? `Added ${newSubTasks.length} sub-task(s) to: ${match.title}`
                  : "Failed to add sub-tasks",
              });
              if (ok)
                toast.success(
                  `Added ${newSubTasks.length} sub-task(s) to "${match.title}"`,
                );
              else toast.error("Failed to add sub-tasks");
              return ok
                ? `Added ${newSubTasks.length} sub-task(s) to "${match.title}": ${newSubTasks.map((s) => `"${s}"`).join(", ")}`
                : "Failed to add sub-tasks";
            }

            if (name === "update_note") {
              const noteTitle = String(args.note_title ?? "");
              const match =
                notesApi.notes.find(
                  (n) => n.title.toLowerCase() === noteTitle.toLowerCase(),
                ) ??
                notesApi.notes.find((n) =>
                  n.title.toLowerCase().includes(noteTitle.toLowerCase()),
                );
              if (!match) {
                return `Could not find a note matching "${noteTitle}"`;
              }
              const updates: { title?: string; content?: string } = {};
              if (args.new_title) updates.title = String(args.new_title);
              if (args.content !== undefined)
                updates.content = String(args.content);
              const statusId = createToolStatusMessage(
                "update_note",
                `Updating note: ${match.title}`,
              );
              await waitForNextPaint();
              const ok = await notesApi.updateNote(match.id, updates);
              updateToolStatusMessage(statusId, {
                tool: "update_note",
                status: ok ? "success" : "error",
                label: ok
                  ? `Updated note: ${updates.title ?? match.title}`
                  : "Failed to update note",
              });
              if (ok)
                toast.success(`Note updated: ${updates.title ?? match.title}`);
              else toast.error("Failed to update note");
              return ok
                ? `Note updated: "${updates.title ?? match.title}"`
                : "Failed to update note";
            }

            if (name === "create_project") {
              const projectName = String(args.name ?? "Untitled Project");
              const description = args.description
                ? String(args.description)
                : undefined;
              const deadline = args.deadline ? String(args.deadline) : null;
              const statusId = createToolStatusMessage(
                "create_project",
                `Creating project: ${projectName}`,
              );
              await waitForNextPaint();
              const project = projectsApi.createProject({
                name: projectName,
                description,
                deadline,
              });
              const ok = !!project;
              updateToolStatusMessage(statusId, {
                tool: "create_project",
                status: ok ? "success" : "error",
                label: ok
                  ? `Created project: ${projectName}`
                  : "Failed to create project",
              });
              if (ok) toast.success(`Project created: ${projectName}`);
              return ok
                ? `Project created: "${projectName}"`
                : "Failed to create project";
            }

            if (name === "link_task_to_project") {
              const taskTitle = String(args.task_title ?? "");
              const projectName = String(args.project_name ?? "");
              const task =
                tasksApi.activeTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.activeTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              if (!task) {
                return `Could not find an active task matching "${taskTitle}"`;
              }
              const project =
                projectsApi.projects.find(
                  (p) => p.name.toLowerCase() === projectName.toLowerCase(),
                ) ??
                projectsApi.projects.find((p) =>
                  p.name.toLowerCase().includes(projectName.toLowerCase()),
                );
              if (!project) {
                return `Could not find a project matching "${projectName}"`;
              }
              const statusId = createToolStatusMessage(
                "link_task_to_project",
                `Linking "${task.title}" → "${project.name}"`,
              );
              await waitForNextPaint();
              projectsApi.linkTask(project.id, task.id);
              updateToolStatusMessage(statusId, {
                tool: "link_task_to_project",
                status: "success",
                label: `Linked task to project: ${project.name}`,
              });
              toast.success(`Task linked to "${project.name}"`);
              return `Task "${task.title}" linked to project "${project.name}"`;
            }

            if (name === "link_note_to_project") {
              const noteTitle = String(args.note_title ?? "");
              const projectName = String(args.project_name ?? "");
              const note =
                notesApi.notes.find(
                  (n) => n.title.toLowerCase() === noteTitle.toLowerCase(),
                ) ??
                notesApi.notes.find((n) =>
                  n.title.toLowerCase().includes(noteTitle.toLowerCase()),
                );
              if (!note) {
                return `Could not find a note matching "${noteTitle}"`;
              }
              const project =
                projectsApi.projects.find(
                  (p) => p.name.toLowerCase() === projectName.toLowerCase(),
                ) ??
                projectsApi.projects.find((p) =>
                  p.name.toLowerCase().includes(projectName.toLowerCase()),
                );
              if (!project) {
                return `Could not find a project matching "${projectName}"`;
              }
              const statusId = createToolStatusMessage(
                "link_note_to_project",
                `Linking "${note.title}" → "${project.name}"`,
              );
              await waitForNextPaint();
              projectsApi.linkNote(project.id, note.id);
              updateToolStatusMessage(statusId, {
                tool: "link_note_to_project",
                status: "success",
                label: `Linked note to project: ${project.name}`,
              });
              toast.success(`Note linked to "${project.name}"`);
              return `Note "${note.title}" linked to project "${project.name}"`;
            }

            if (name === "unarchive_task") {
              const taskTitle = String(args.task_title ?? "");
              const match =
                tasksApi.archivedTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.archivedTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              if (!match) {
                return `Could not find an archived task matching "${taskTitle}"`;
              }
              const statusId = createToolStatusMessage(
                "unarchive_task",
                `Restoring: ${match.title}`,
              );
              await waitForNextPaint();
              const ok = await tasksApi.unarchiveTask(match.id);
              updateToolStatusMessage(statusId, {
                tool: "unarchive_task",
                status: ok ? "success" : "error",
                label: ok
                  ? `Restored task: ${match.title}`
                  : "Failed to restore task",
              });
              if (ok) toast.success(`Task restored: ${match.title}`);
              else toast.error("Failed to restore task");
              return ok
                ? `Task restored from archive: "${match.title}"`
                : "Failed to restore task from archive";
            }

            if (name === "delete_task") {
              const taskTitle = String(args.task_title ?? "");
              // Check active tasks first, then archived
              const activeMatch =
                tasksApi.activeTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.activeTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              const archivedMatch =
                tasksApi.archivedTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.archivedTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              const match = activeMatch ?? archivedMatch;
              if (!match) {
                return `Could not find a task matching "${taskTitle}"`;
              }
              const statusId = createToolStatusMessage(
                "delete_task",
                `Deleting task: ${match.title}`,
              );
              await waitForNextPaint();
              let ok: boolean;
              if (activeMatch) {
                // Archive first, then delete forever
                ok = await tasksApi.archiveTask(match.id);
                if (ok) ok = await tasksApi.deleteForever(match.id);
              } else {
                ok = await tasksApi.deleteForever(match.id);
              }
              updateToolStatusMessage(statusId, {
                tool: "delete_task",
                status: ok ? "success" : "error",
                label: ok
                  ? `Deleted task: ${match.title}`
                  : "Failed to delete task",
              });
              if (ok) toast.success(`Task deleted: ${match.title}`);
              else toast.error("Failed to delete task");
              return ok
                ? `Task permanently deleted: "${match.title}"`
                : "Failed to delete task";
            }

            if (name === "delete_project") {
              const projectName = String(args.project_name ?? "");
              const project =
                projectsApi.projects.find(
                  (p) => p.name.toLowerCase() === projectName.toLowerCase(),
                ) ??
                projectsApi.projects.find((p) =>
                  p.name.toLowerCase().includes(projectName.toLowerCase()),
                );
              if (!project) {
                return `Could not find a project matching "${projectName}"`;
              }
              const statusId = createToolStatusMessage(
                "delete_project",
                `Deleting project: ${project.name}`,
              );
              await waitForNextPaint();
              const ok = projectsApi.deleteProject(project.id);
              updateToolStatusMessage(statusId, {
                tool: "delete_project",
                status: ok ? "success" : "error",
                label: ok
                  ? `Deleted project: ${project.name}`
                  : "Failed to delete project",
              });
              if (ok) toast.success(`Project deleted: ${project.name}`);
              else toast.error("Failed to delete project");
              return ok
                ? `Project deleted: "${project.name}" (linked tasks and notes were kept)`
                : "Failed to delete project";
            }

            if (name === "update_project") {
              const projectName = String(args.project_name ?? "");
              const project =
                projectsApi.projects.find(
                  (p) => p.name.toLowerCase() === projectName.toLowerCase(),
                ) ??
                projectsApi.projects.find((p) =>
                  p.name.toLowerCase().includes(projectName.toLowerCase()),
                );
              if (!project) {
                return `Could not find a project matching "${projectName}"`;
              }
              const updates: {
                name?: string;
                description?: string;
                deadline?: string | null;
              } = {};
              if (args.new_name) updates.name = String(args.new_name);
              if (args.description !== undefined)
                updates.description = String(args.description);
              if (args.deadline !== undefined)
                updates.deadline =
                  args.deadline === "" ? null : String(args.deadline);
              const statusId = createToolStatusMessage(
                "update_project",
                `Updating project: ${project.name}`,
              );
              await waitForNextPaint();
              const ok = projectsApi.updateProject(project.id, updates);
              updateToolStatusMessage(statusId, {
                tool: "update_project",
                status: ok ? "success" : "error",
                label: ok
                  ? `Updated project: ${updates.name ?? project.name}`
                  : "Failed to update project",
              });
              if (ok)
                toast.success(
                  `Project updated: ${updates.name ?? project.name}`,
                );
              else toast.error("Failed to update project");
              return ok
                ? `Project updated: "${updates.name ?? project.name}"`
                : "Failed to update project";
            }

            if (name === "unlink_task_from_project") {
              const taskTitle = String(args.task_title ?? "");
              const projectName = String(args.project_name ?? "");
              const task =
                tasksApi.activeTasks.find(
                  (t) => t.title.toLowerCase() === taskTitle.toLowerCase(),
                ) ??
                tasksApi.activeTasks.find((t) =>
                  t.title.toLowerCase().includes(taskTitle.toLowerCase()),
                );
              if (!task) {
                return `Could not find an active task matching "${taskTitle}"`;
              }
              const project =
                projectsApi.projects.find(
                  (p) => p.name.toLowerCase() === projectName.toLowerCase(),
                ) ??
                projectsApi.projects.find((p) =>
                  p.name.toLowerCase().includes(projectName.toLowerCase()),
                );
              if (!project) {
                return `Could not find a project matching "${projectName}"`;
              }
              const statusId = createToolStatusMessage(
                "unlink_task_from_project",
                `Unlinking "${task.title}" from "${project.name}"`,
              );
              await waitForNextPaint();
              projectsApi.unlinkTask(project.id, task.id);
              updateToolStatusMessage(statusId, {
                tool: "unlink_task_from_project",
                status: "success",
                label: `Unlinked task from project: ${project.name}`,
              });
              toast.success(`Task unlinked from "${project.name}"`);
              return `Task "${task.title}" unlinked from project "${project.name}"`;
            }

            if (name === "unlink_note_from_project") {
              const noteTitle = String(args.note_title ?? "");
              const projectName = String(args.project_name ?? "");
              const note =
                notesApi.notes.find(
                  (n) => n.title.toLowerCase() === noteTitle.toLowerCase(),
                ) ??
                notesApi.notes.find((n) =>
                  n.title.toLowerCase().includes(noteTitle.toLowerCase()),
                );
              if (!note) {
                return `Could not find a note matching "${noteTitle}"`;
              }
              const project =
                projectsApi.projects.find(
                  (p) => p.name.toLowerCase() === projectName.toLowerCase(),
                ) ??
                projectsApi.projects.find((p) =>
                  p.name.toLowerCase().includes(projectName.toLowerCase()),
                );
              if (!project) {
                return `Could not find a project matching "${projectName}"`;
              }
              const statusId = createToolStatusMessage(
                "unlink_note_from_project",
                `Unlinking "${note.title}" from "${project.name}"`,
              );
              await waitForNextPaint();
              projectsApi.unlinkNote(project.id, note.id);
              updateToolStatusMessage(statusId, {
                tool: "unlink_note_from_project",
                status: "success",
                label: `Unlinked note from project: ${project.name}`,
              });
              toast.success(`Note unlinked from "${project.name}"`);
              return `Note "${note.title}" unlinked from project "${project.name}"`;
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
            thinkingFallbackRef.current = false;
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
            thinkingFallbackRef.current = false;
            setStreaming(false);
            abortRef.current = null;
          },
        },
        controller.signal,
        shouldThink ? { thinkingEnabled: true } : undefined,
      );
    },
    [
      closeActiveAssistantMessage,
      createToolStatusMessage,
      ensureActiveAssistantMessage,
      input,
      streaming,
      messages,
      tasksApi,
      notesApi,
      projectsApi,
      meetingApi,
      activeSession,
      meetingSessions,
      userName,
      user,
      scrollToBottom,
      thinkingMode,
      updateToolStatusMessage,
      waitForNextPaint,
    ],
  );

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    activeAssistantMessageIdRef.current = null;
    activeAssistantHasOutputRef.current = false;
    thinkingFallbackRef.current = false;
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
    <div className="flex flex-col h-dvh md:h-screen animate-fade-in">
      {/* Header */}
      <header className="shrink-0 border-b border-white/6 px-4 pr-17 sm:px-6 sm:pr-6 h-18 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
          <BrainCircuit size={16} className="text-violet-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-white tracking-tight">Luna</h1>
          <p className="text-[10px] text-white/30">Your Orbit AI assistant</p>
        </div>
        {activeModelSupportsThinking() &&
          getAiSettings().provider !== "gemini" && (
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
        {!isUser && message.thinkingFallback && (
          <div className="mb-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/15 bg-amber-500/7 px-3 py-1.5 text-[11px] font-medium text-amber-300/80">
              <Sparkles size={11} />
              Thinking mode unavailable, retried without it
            </span>
          </div>
        )}

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
                ) : tr.tool === "create_task" || tr.tool === "complete_task" ? (
                  <CheckCircle2 size={12} />
                ) : tr.tool === "archive_task" ? (
                  <Archive size={12} />
                ) : tr.tool === "unarchive_task" ? (
                  <ArchiveRestore size={12} />
                ) : tr.tool === "create_note" ? (
                  <StickyNote size={12} />
                ) : tr.tool === "delete_note" || tr.tool === "delete_task" ? (
                  <Trash2 size={12} />
                ) : tr.tool === "add_subtasks" ? (
                  <ListChecks size={12} />
                ) : tr.tool === "transform_text" ? (
                  <PenLine size={12} />
                ) : tr.tool === "start_meeting" ||
                  tr.tool === "add_meeting_entry" ||
                  tr.tool === "end_meeting" ? (
                  <Video size={12} />
                ) : tr.tool === "recategorize_tasks" ||
                  tr.tool === "recategorize_notes" ? (
                  <RefreshCw size={12} />
                ) : tr.tool === "create_project" ||
                  tr.tool === "update_project" ||
                  tr.tool === "delete_project" ? (
                  <FolderOpen size={12} />
                ) : tr.tool === "unlink_task_from_project" ||
                  tr.tool === "unlink_note_from_project" ? (
                  <Unlink size={12} />
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
            "Archive all low-priority tasks",
            "Start a meeting called Weekly Sync",
            "Fix the grammar in this text: [paste here]",
            "Regenerate all my task categories",
            "Summarize my current notes",
            "Delete my note about the weekend",
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
