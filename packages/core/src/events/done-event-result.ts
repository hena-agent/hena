import type { CoreEvent } from "./events";

export const doneEventResult = (): IteratorResult<CoreEvent> => ({
  done: true,
  value: undefined,
});
