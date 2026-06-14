import { Effect } from "effect";
import type { ToolCall } from "../common/common";
import { type CoreServices, ToolRegistry } from "../services/services";
import { appendEntry } from "../state/append-entry";
import { emit } from "../state/emit";
import type { SessionState } from "../state/state";
import type { ToolRun } from "./dispatch";
import { errorRun } from "./error-run";
import { makeToolResult } from "./make-tool-result";
import { runKnownTool } from "./run-known-tool";

export const dispatchToolCall = (
  state: SessionState,
  call: ToolCall,
  signal: AbortSignal,
): Effect.Effect<ToolRun, never, CoreServices> =>
  Effect.gen(function* () {
    const registry = yield* ToolRegistry;
    yield* emit(state, { toolCall: call, type: "tool_start" });
    const tool = registry.get(call.name);
    const run =
      tool === undefined
        ? errorRun(`Unknown tool: ${call.name}`)
        : yield* runKnownTool(state, call, tool, signal);
    const entry = yield* makeToolResult(state, call, run);
    yield* appendEntry(state, entry);
    yield* emit(state, { entry, type: "tool_end" });
    return run;
  });
