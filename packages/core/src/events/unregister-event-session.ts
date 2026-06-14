import { closeEventSession } from "./close-event-session";
import type { EventSessions } from "./event-log";

export const unregisterEventSession = (
  sessions: EventSessions,
  sessionId: string,
): void => {
  const session = sessions.get(sessionId);
  if (session !== undefined) {
    closeEventSession(session);
    sessions.delete(sessionId);
  }
};
