import { Effect } from "effect";
import type { CoreEvent } from "./events";
export type EventSessions = Map<string, EventSession>;

type EventSession = {
  readonly history: CoreEvent[];
  readonly waiters: Set<EventWaiter>;
  closed: boolean;
};

type EventWaiter = {
  readonly resolve: (result: IteratorResult<CoreEvent>) => void;
};

export function shutdownEventSessions(
  sessions: EventSessions,
): Effect.Effect<void> {
  return Effect.sync(() => {
    for (const session of sessions.values()) {
      closeSession(session);
    }
    sessions.clear();
  });
}

export function eventSessionIterable(
  sessions: EventSessions,
  sessionId: string,
): Effect.Effect<AsyncIterable<CoreEvent>> {
  return Effect.sync(() => eventIterable(sessionState(sessions, sessionId)));
}

export function registerEventSession(
  sessions: EventSessions,
  sessionId: string,
): Effect.Effect<void> {
  return Effect.sync(() => {
    sessions.set(sessionId, makeEventSession());
  });
}

export function unregisterEventSession(
  sessions: EventSessions,
  sessionId: string,
): Effect.Effect<void> {
  return Effect.sync(() => {
    const session = sessions.get(sessionId);
    if (session !== undefined) {
      closeSession(session);
      sessions.delete(sessionId);
    }
  });
}

export function publishEventToSession(
  sessions: EventSessions,
  event: CoreEvent,
): Effect.Effect<void> {
  return Effect.sync(() => {
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
  });
}

function makeEventSession(): EventSession {
  return { closed: false, history: [], waiters: new Set() };
}

function sessionState(
  sessions: EventSessions,
  sessionId: string,
): EventSession {
  const existing = sessions.get(sessionId);
  if (existing !== undefined) {
    return existing;
  }
  return { closed: true, history: [], waiters: new Set() };
}

function eventIterable(session: EventSession): AsyncIterable<CoreEvent> {
  return {
    [Symbol.asyncIterator]: () => eventIterator(session),
  };
}

function eventIterator(session: EventSession): AsyncIterator<CoreEvent> {
  let active = true;
  let index = 0;
  let waiter: EventWaiter | undefined;
  return {
    next: async (): Promise<IteratorResult<CoreEvent>> => {
      if (!active) {
        return doneResult();
      }
      const event = session.history[index];
      if (event !== undefined) {
        index += 1;
        return { done: false, value: event };
      }
      if (session.closed) {
        active = false;
        return doneResult();
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
        waiter.resolve(doneResult());
        waiter = undefined;
      }
      const result = await Promise.resolve(doneResult());
      return result;
    },
  };
}

function closeSession(session: EventSession): void {
  session.closed = true;
  const waiters = Array.from(session.waiters);
  session.waiters.clear();
  for (const waiter of waiters) {
    waiter.resolve(doneResult());
  }
}

function doneResult(): IteratorResult<CoreEvent> {
  return { done: true, value: undefined };
}
