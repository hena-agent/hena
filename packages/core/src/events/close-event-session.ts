import { doneEventResult } from "./done-event-result";
import type { EventSession } from "./event-log";

export const closeEventSession = (session: EventSession): void => {
  session.closed = true;
  const waiters = Array.from(session.waiters);
  session.waiters.clear();
  for (const waiter of waiters) {
    waiter.resolve(doneEventResult());
  }
};
