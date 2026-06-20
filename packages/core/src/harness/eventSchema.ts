import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Schema } from "effect";

export const HarnessEventDTO = Schema.Struct({
  version: Schema.Literal(1),
  event: Schema.Unknown,
});

export type HarnessEventDTO = Schema.Schema.Type<typeof HarnessEventDTO>;

export interface HarnessEventEnvelope {
  readonly version: 1;
  readonly event: PiAgent.AgentHarnessEvent;
}

export const toHarnessEventDTO = (
  event: PiAgent.AgentHarnessEvent,
): HarnessEventEnvelope => ({ version: 1, event });
