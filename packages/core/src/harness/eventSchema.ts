import type * as PiAgent from "@earendil-works/pi-agent-core";

export interface HarnessEventEnvelope {
  readonly version: 1;
  readonly event: PiAgent.AgentHarnessEvent;
}

export const toHarnessEventEnvelope = (
  event: PiAgent.AgentHarnessEvent,
): HarnessEventEnvelope => ({ version: 1, event });
