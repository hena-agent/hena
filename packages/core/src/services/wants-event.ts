import type { CoreEvent } from "../events/events";
import type { EventObserver } from "../extensions/extension";

export const wantsEvent = (
  observer: EventObserver,
  event: CoreEvent,
): boolean => observer.type === "event" || observer.type === event.type;
