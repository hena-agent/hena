import type { EventSessions } from "./event-log";
import type { CoreEvent } from "./events";

export const publishEventToSession = (
  sessions: EventSessions,
  event: CoreEvent,
): void => {
  const session = sessions.get(event.sessionId);
  if (session === undefined || session.closed) {
    return;
  }
  session.history.push(event);
  const waiters = Array.from(session.waiters);
  session.waiters.clear();
  for (const waiter of waiters) {
    waiter.resolve({ done: false, value: event });
  }
};
