import { eventIterator } from "./event-iterator";
import type { EventSession } from "./event-log";
import type { CoreEvent } from "./events";

export const eventIterable = (
  session: EventSession,
): AsyncIterable<CoreEvent> => ({
  [Symbol.asyncIterator]: (): AsyncIterator<CoreEvent> =>
    eventIterator(session),
});
