import type { CoreEvent } from "../events/events";
import type { EventObserver } from "../extensions/extension";

export const notifyObserver = async (
  observer: EventObserver,
  event: CoreEvent,
): Promise<void> => {
  try {
    await observer.handler(event);
  } catch {
    return undefined;
  }
};
