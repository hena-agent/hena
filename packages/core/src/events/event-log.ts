import type { CoreEvent } from "./events";
export type EventSessions = Map<string, EventSession>;

export type EventSession = {
  readonly history: CoreEvent[];
  readonly waiters: Set<EventWaiter>;
  closed: boolean;
};

export type EventWaiter = {
  readonly resolve: (result: IteratorResult<CoreEvent>) => void;
};
