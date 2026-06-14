import { Layer } from "effect";
import type { EventSessions } from "../events/event-log";
import { eventSessionIterable } from "../events/event-session-iterable";
import type { CoreEvent } from "../events/events";
import { registerEventSession } from "../events/register-event-session";
import { unregisterEventSession } from "../events/unregister-event-session";
import type { EventObserver } from "../extensions/extension";
import { publishEvent } from "./publish-event";
import { EventBus, type EventBusId } from "./services";

export const makeEventBusLayer = (
  observers: readonly EventObserver[],
): Layer.Layer<EventBusId> =>
  Layer.sync(EventBus, () => {
    const sessions: EventSessions = new Map();
    return EventBus.of({
      register: (sessionId: string) => {
        registerEventSession(sessions, sessionId);
      },
      publish: (event: CoreEvent) => {
        publishEvent(sessions, observers, event);
      },
      stream: (sessionId: string) => eventSessionIterable(sessions, sessionId),
      unregister: (sessionId: string) => {
        unregisterEventSession(sessions, sessionId);
      },
    });
  });
