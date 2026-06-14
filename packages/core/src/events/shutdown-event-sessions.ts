import { closeEventSession } from "./close-event-session";
import type { EventSessions } from "./event-log";

export const shutdownEventSessions = (sessions: EventSessions): void => {
  for (const session of sessions.values()) {
    closeEventSession(session);
  }
  sessions.clear();
};
