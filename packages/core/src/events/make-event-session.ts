import type { EventSession } from "./event-log";

export const makeEventSession = (): EventSession => ({
  closed: false,
  history: [],
  waiters: new Set(),
});
