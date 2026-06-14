import type { CoreEvent } from "../events/events";
import type { EventObserver } from "../extensions/extension";
import { notifyObserver } from "./notify-observer";
import { wantsEvent } from "./wants-event";

export const notifyObservers = (
  observers: readonly EventObserver[],
  event: CoreEvent,
): void => {
  const targets = observers.filter((observer) => wantsEvent(observer, event));
  for (const observer of targets) {
    void notifyObserver(observer, event);
  }
};
