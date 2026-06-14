import { Effect } from "effect";
import type { ToolCall } from "../common/common";
import { nextEntryId } from "../state/next-entry-id";
import { now } from "../state/now";
import type { SessionState } from "../state/state";
import type { ToolResultEntry } from "../transcript/transcript";
import type { ToolRun } from "./dispatch";

export const makeToolResult = (
  state: SessionState,
  call: ToolCall,
  run: ToolRun,
): Effect.Effect<ToolResultEntry> =>
  Effect.map(nextEntryId(state), (id) => ({
    content: run.output,
    id,
    isError: run.type !== "success",
    role: "tool_result",
    timestamp: now(),
    toolCallId: call.id,
    toolName: call.name,
  }));
