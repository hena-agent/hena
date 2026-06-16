import { Effect, Option, Stream } from "effect";
import { Prompt } from "effect/unstable/ai";

import type { RuntimeContext } from "./context";
import { ToolExecutionError } from "./errors";
import { RuntimeEvent } from "./events";
import type { RegisteredTool } from "./tool";
import { publishToolResult } from "./tool-result";
import { appendEntry } from "./transcript";

export const runTools: (
  context: RuntimeContext,
  calls: ReadonlyArray<Prompt.ToolCallPart>,
) => Effect.Effect<void, ToolExecutionError> = Effect.fnUntraced(
  function* (context, calls) {
    if (calls.length === 0) {
      return;
    }

    yield* Effect.forEach(
      calls,
      (call) => context.events.publish(RuntimeEvent.toolStart(call)),
      { discard: true },
    );
    const parts = yield* Effect.forEach(
      calls,
      (call) => runTool(context, call),
      {
        concurrency: "unbounded",
      },
    );
    const message = Prompt.toolMessage({ content: parts });

    yield* appendEntry(context.entries, message);
  },
);

const runTool: (
  context: RuntimeContext,
  call: Prompt.ToolCallPart,
) => Effect.Effect<Prompt.ToolResultPart, ToolExecutionError> =
  Effect.fnUntraced(function* (context, call) {
    const tool = yield* context.registry.tool(call.name);
    return yield* runRegisteredTool(context, tool, call);
  });

const runRegisteredTool = (
  context: RuntimeContext,
  tool: RegisteredTool | undefined,
  call: Prompt.ToolCallPart,
): Effect.Effect<Prompt.ToolResultPart, ToolExecutionError> => {
  /* istanbul ignore next -- Effect AI decodes tool calls against the toolkit. */
  if (tool === undefined) {
    return publishToolResult(context, call, {
      result: `Unknown tool: ${call.name}`,
      encodedResult: `Unknown tool: ${call.name}`,
      isFailure: true,
      preliminary: false,
    });
  }
  return Effect.gen(function* () {
    const results = yield* tool.handle(call.params).pipe(
      Effect.flatMap((stream) =>
        Stream.runFoldEffect(
          stream,
          () => Option.none<Prompt.ToolResultPart>(),
          (final, result) =>
            Effect.map(publishToolResult(context, call, result), (part) =>
              result.preliminary === true ? final : Option.some(part),
            ),
        ),
      ),
      Effect.mapError((error) => new ToolExecutionError({ error })),
    );

    /* istanbul ignore next -- Toolkit handlers always emit a final result. */
    if (Option.isNone(results)) {
      return yield* new ToolExecutionError({
        error: `Tool handler did not produce a final result: ${call.name}`,
      });
    }
    return results.value;
  });
};
