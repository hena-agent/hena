import { Effect } from "effect";
import type { ToolCall } from "../common/common";
import type { CoreServices } from "../services/services";
import type { SessionState } from "../state/state";
import type { ToolDispatchResult } from "./dispatch";
import { dispatchToolCall } from "./dispatch-tool-call";

export const dispatchToolCalls = (
  state: SessionState,
  calls: readonly ToolCall[],
  signal: AbortSignal,
): Effect.Effect<ToolDispatchResult, never, CoreServices> =>
  Effect.gen(function* () {
    for (const call of calls) {
      if (signal.aborted) {
        return { type: "aborted" };
      }
      const run = yield* dispatchToolCall(state, call, signal);
      if (run.type === "aborted") {
        return { type: "aborted" };
      }
    }
    return { type: "completed" };
  });
