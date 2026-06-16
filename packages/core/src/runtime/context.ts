import type { Ref } from "effect";
import type { Prompt } from "effect/unstable/ai";

import type { EventLog } from "./events";
import type { Registry } from "./registry";

export interface RuntimeContext {
  readonly entries: Ref.Ref<ReadonlyArray<Prompt.Message>>;
  readonly events: EventLog;
  readonly registry: Registry;
}
