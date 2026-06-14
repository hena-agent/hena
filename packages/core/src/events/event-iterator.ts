import { doneEventResult } from "./done-event-result";
import type { EventSession, EventWaiter } from "./event-log";
import type { CoreEvent } from "./events";

export const eventIterator = (
  session: EventSession,
): AsyncIterator<CoreEvent> => {
  let active = true;
  let index = 0;
  let waiter: EventWaiter | undefined;
  return {
    next: async (): Promise<IteratorResult<CoreEvent>> => {
      if (!active) {
        return doneEventResult();
      }
      const event = session.history[index];
      if (event !== undefined) {
        index += 1;
        return { done: false, value: event };
      }
      if (session.closed) {
        active = false;
        return doneEventResult();
      }
      const result = await new Promise<IteratorResult<CoreEvent>>((resolve) => {
        waiter = {
          resolve: (nextResult: IteratorResult<CoreEvent>): void => {
            waiter = undefined;
            if (nextResult.done !== true) {
              index += 1;
            }
            resolve(nextResult);
          },
        };
        session.waiters.add(waiter);
      });
      return result;
    },
    return: async (): Promise<IteratorResult<CoreEvent>> => {
      active = false;
      if (waiter !== undefined) {
        session.waiters.delete(waiter);
        waiter.resolve(doneEventResult());
        waiter = undefined;
      }
      const result = await Promise.resolve(doneEventResult());
      return result;
    },
  };
};
