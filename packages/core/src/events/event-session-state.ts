import type { EventSession, EventSessions } from "./event-log";

export const eventSessionState = (
  sessions: EventSessions,
  sessionId: string,
): EventSession => {
  const existing = sessions.get(sessionId);
  if (existing !== undefined) {
    return existing;
  }
  return { closed: true, history: [], waiters: new Set() };
};
