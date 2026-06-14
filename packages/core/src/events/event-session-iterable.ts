import { eventIterable } from "./event-iterable";
import type { EventSessions } from "./event-log";
import { eventSessionState } from "./event-session-state";
import type { CoreEvent } from "./events";

export const eventSessionIterable = (
  sessions: EventSessions,
  sessionId: string,
): AsyncIterable<CoreEvent> =>
  eventIterable(eventSessionState(sessions, sessionId));
