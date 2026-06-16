import { Schema } from "effect";

import { LifecycleEvents } from "./lifecycle";
import { MessageEvents } from "./message";
import { TerminalEvents } from "./terminal";
import { ToolEvents } from "./tool";

export const AgentEventSchemas = [
  ...LifecycleEvents,
  ...MessageEvents,
  ...ToolEvents,
  ...TerminalEvents,
] as const;

export const AgentEvent = Schema.Union(AgentEventSchemas).annotate({
  identifier: "AgentEvent",
});
export type AgentEvent = Schema.Schema.Type<typeof AgentEvent>;
