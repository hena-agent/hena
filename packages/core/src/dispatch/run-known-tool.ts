import { Effect } from "effect";
import type { ToolCall } from "../common/common";
import type { CoreServices } from "../services/services";
import type { SessionState } from "../state/state";
import type { Tool } from "../tools/tools";
import { validateInput } from "../validation/validate-input";
import type { ToolRun } from "./dispatch";
import { errorRun } from "./error-run";
import { executeTool } from "./execute-tool";

export const runKnownTool = (
  state: SessionState,
  call: ToolCall,
  tool: Tool,
  signal: AbortSignal,
): Effect.Effect<ToolRun, never, CoreServices> =>
  Effect.gen(function* () {
    const validation = yield* validateInput(tool, call.input);
    if (validation.type === "invalid") {
      return errorRun(validation.message);
    }
    return yield* executeTool(state, call, tool, {
      input: validation.input,
      signal,
    });
  });
