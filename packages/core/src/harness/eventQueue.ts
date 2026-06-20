import type * as PiAgent from "@earendil-works/pi-agent-core";

type ReliableQueuedEvent = {
  readonly _tag: "reliable";
  readonly event: PiAgent.AgentHarnessEvent;
};

export type DeltaQueuedEvent = {
  readonly _tag: "deltaFlush";
  readonly key: string;
  event: PiAgent.AgentHarnessEvent;
};

export type QueuedEvent = ReliableQueuedEvent | DeltaQueuedEvent;

export const deltaKey = (
  event: PiAgent.AgentHarnessEvent,
): string | undefined => {
  if (event.type === "message_update") {
    return "message";
  }
  if (event.type === "tool_execution_update") {
    return `tool:${event.toolCallId}`;
  }
  return undefined;
};
