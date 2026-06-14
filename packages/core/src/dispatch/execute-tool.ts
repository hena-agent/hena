import { Effect } from "effect";
import type { ToolCall, ToolOutput } from "../common/common";
import { errorFromUnknown } from "../common/error-from-unknown";
import { raceAbort } from "../common/race-abort";
import { type CoreServices, EventBus } from "../services/services";
import type { SessionState } from "../state/state";
import type { Tool } from "../tools/tools";
import type { ExecuteToolOptions, ToolRun } from "./dispatch";
import { makeToolUpdateSink } from "./make-tool-update-sink";
import { toolRunFromError } from "./tool-run-from-error";

export const executeTool = (
  state: SessionState,
  call: ToolCall,
  tool: Tool,
  options: ExecuteToolOptions,
): Effect.Effect<ToolRun, never, CoreServices> =>
  Effect.gen(function* () {
    const bus = yield* EventBus;
    const updates = makeToolUpdateSink(state, bus, call.id);
    return yield* Effect.tryPromise({
      catch: (cause: unknown) =>
        errorFromUnknown(cause, { signal: options.signal }),
      try: async (runtimeSignal: AbortSignal): Promise<ToolOutput> => {
        const signal = AbortSignal.any([options.signal, runtimeSignal]);
        const output = await raceAbort(async () => {
          const result = await Promise.resolve(
            tool.execute(options.input, {
              sessionId: state.id,
              signal,
              toolCallId: call.id,
              update: updates.update,
            }),
          );
          return result;
        }, signal);
        return output;
      },
    }).pipe(
      Effect.ensuring(Effect.promise(updates.close)),
      Effect.map((output) => ({ output, type: "success" }) satisfies ToolRun),
      Effect.catch((error) => Effect.succeed(toolRunFromError(error))),
    );
  });
