import type { EventSessions } from "../events/event-log";
import type { CoreEvent } from "../events/events";
import { publishEventToSession } from "../events/publish-event-to-session";
import type { EventObserver } from "../extensions/extension";
import { notifyObservers } from "./notify-observers";

export const publishEvent = (
  sessions: EventSessions,
  observers: readonly EventObserver[],
  event: CoreEvent,
): void => {
  publishEventToSession(sessions, event);
  notifyObservers(observers, event);
};
