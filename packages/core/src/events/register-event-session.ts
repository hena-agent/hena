import type { EventSessions } from "./event-log";
import { makeEventSession } from "./make-event-session";

export const registerEventSession = (
  sessions: EventSessions,
  sessionId: string,
): void => {
  sessions.set(sessionId, makeEventSession());
};
