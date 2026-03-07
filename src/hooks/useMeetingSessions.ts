import { useCallback, useEffect, useRef, useState } from "react";
type MeetingTaskPriority = "low" | "medium" | "high";

export interface MeetingSessionEntry {
  id: string;
  content: string;
  createdAt: string;
}

export interface MeetingSessionArtifacts {
  createdAt: string;
  model: string | null;
  warning?: string | null;
  note: {
    title: string;
    content: string;
    noteId?: string | null;
  };
  task: {
    title: string;
    description: string;
    priority: MeetingTaskPriority;
    subTasks: string[];
    taskId?: string | null;
  };
}

export interface MeetingSession {
  id: string;
  title: string;
  startedAt: string;
  endedAt: string | null;
  entries: MeetingSessionEntry[];
  artifacts?: MeetingSessionArtifacts;
}

interface StoredMeetingState {
  activeSession: MeetingSession | null;
  sessions: MeetingSession[];
}

interface StoredMeetingSnapshot {
  storageKey: string;
  state: StoredMeetingState;
}

const STORAGE_PREFIX = "orbit:meeting-sessions";
const STORAGE_EVENT = "orbit:meeting-sessions:changed";

function createStorageKey(userId?: string): string {
  return `${STORAGE_PREFIX}:${userId ?? "_"}`;
}

function normalizeSessions(sessions: MeetingSession[]): MeetingSession[] {
  return [...sessions].sort((left, right) => {
    const leftTime = left.endedAt ?? left.startedAt;
    const rightTime = right.endedAt ?? right.startedAt;
    return rightTime.localeCompare(leftTime);
  });
}

function readStoredState(storageKey: string): StoredMeetingState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return { activeSession: null, sessions: [] };
    }

    const parsed = JSON.parse(raw) as Partial<StoredMeetingState>;
    return {
      activeSession: parsed.activeSession ?? null,
      sessions: normalizeSessions(parsed.sessions ?? []),
    };
  } catch {
    return { activeSession: null, sessions: [] };
  }
}

function writeStoredState(storageKey: string, state: StoredMeetingState): void {
  if (!state.activeSession && state.sessions.length === 0) {
    localStorage.removeItem(storageKey);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(STORAGE_EVENT, { detail: { storageKey } }),
      );
    }
    return;
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify({
      activeSession: state.activeSession,
      sessions: normalizeSessions(state.sessions),
    }),
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(STORAGE_EVENT, { detail: { storageKey } }),
    );
  }
}

export function useMeetingSessions(userId?: string) {
  const storageKey = createStorageKey(userId);
  const [snapshot, setSnapshot] = useState<StoredMeetingSnapshot>(() => ({
    storageKey,
    state: readStoredState(storageKey),
  }));
  const state =
    snapshot.storageKey === storageKey
      ? snapshot.state
      : readStoredState(storageKey);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const syncState = (nextStorageKey?: string) => {
      if (nextStorageKey && nextStorageKey !== storageKey) return;
      const nextState = readStoredState(storageKey);
      stateRef.current = nextState;
      setSnapshot({ storageKey, state: nextState });
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== storageKey) return;
      syncState(storageKey);
    };

    const handleInternalSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ storageKey?: string }>;
      syncState(customEvent.detail?.storageKey);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(STORAGE_EVENT, handleInternalSync as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        STORAGE_EVENT,
        handleInternalSync as EventListener,
      );
    };
  }, [storageKey]);

  const applyStateUpdate = useCallback(
    (updater: (current: StoredMeetingState) => StoredMeetingState) => {
      const next = updater(stateRef.current);
      stateRef.current = next;
      setSnapshot({ storageKey, state: next });
      writeStoredState(storageKey, next);
      return next;
    },
    [storageKey],
  );

  const updateState = useCallback(
    (updater: (current: StoredMeetingState) => StoredMeetingState) => {
      return applyStateUpdate(updater);
    },
    [applyStateUpdate],
  );

  const startSession = useCallback(
    (title: string) => {
      const normalizedTitle = title.trim();
      if (!normalizedTitle) return null;

      const session: MeetingSession = {
        id: crypto.randomUUID(),
        title: normalizedTitle,
        startedAt: new Date().toISOString(),
        endedAt: null,
        entries: [],
      };

      let created: MeetingSession | null = null;
      updateState((current) => {
        if (current.activeSession) return current;
        created = session;
        return {
          ...current,
          activeSession: session,
        };
      });

      return created;
    },
    [updateState],
  );

  const addEntry = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return false;

      let added = false;
      updateState((current) => {
        if (!current.activeSession) return current;
        added = true;

        return {
          ...current,
          activeSession: {
            ...current.activeSession,
            entries: [
              ...current.activeSession.entries,
              {
                id: crypto.randomUUID(),
                content: trimmed,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        };
      });

      return added;
    },
    [updateState],
  );

  const endSession = useCallback(
    (artifacts: MeetingSessionArtifacts) => {
      let completed: MeetingSession | null = null;

      updateState((current) => {
        if (!current.activeSession) return current;

        completed = {
          ...current.activeSession,
          endedAt: new Date().toISOString(),
          artifacts,
        };

        return {
          activeSession: null,
          sessions: normalizeSessions([
            completed,
            ...current.sessions.filter(
              (session) => session.id !== current.activeSession?.id,
            ),
          ]),
        };
      });

      return completed;
    },
    [updateState],
  );

  const deleteSession = useCallback(
    (sessionId: string) => {
      let removed = false;

      updateState((current) => {
        const nextSessions = current.sessions.filter((session) => {
          const keep = session.id !== sessionId;
          if (!keep) removed = true;
          return keep;
        });

        const activeSession =
          current.activeSession?.id === sessionId
            ? null
            : current.activeSession;
        if (current.activeSession?.id === sessionId) removed = true;

        return {
          activeSession,
          sessions: nextSessions,
        };
      });

      return removed;
    },
    [updateState],
  );

  const discardActiveSession = useCallback(() => {
    let removed = false;

    updateState((current) => {
      if (!current.activeSession) return current;
      removed = true;
      return {
        ...current,
        activeSession: null,
      };
    });

    return removed;
  }, [updateState]);

  return {
    activeSession: state.activeSession,
    sessions: state.sessions,
    startSession,
    addEntry,
    endSession,
    deleteSession,
    discardActiveSession,
  };
}

export type MeetingSessionsApi = ReturnType<typeof useMeetingSessions>;
