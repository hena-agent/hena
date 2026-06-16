import { Effect } from "effect";
import { Prompt } from "effect/unstable/ai";

import type { RuntimeContext } from "./context";
import { RuntimeEvent } from "./events";
import type { RegisteredTool } from "./tool";
import { appendEntry } from "./transcript";

export const runTools: (
  context: RuntimeContext,
  calls: ReadonlyArray<Prompt.ToolCallPart>,
) => Effect.Effect<void> = Effect.fnUntraced(function* (context, calls) {
  if (calls.length === 0) {
    return;
  }

  yield* Effect.forEach(
    calls,
    (call) => context.events.publish(RuntimeEvent.toolStart(callMessage(call))),
    { discard: true },
  );
  const parts = yield* Effect.forEach(calls, (call) => runTool(context, call), {
    concurrency: "unbounded",
  });
  const message = Prompt.toolMessage({ content: parts });

  yield* appendEntry(context.entries, message);
  yield* Effect.forEach(
    parts,
    (part) =>
      context.events.publish(
        RuntimeEvent.toolEnd(Prompt.toolMessage({ content: [part] })),
      ),
    { discard: true },
  );
});

const runTool: (
  context: RuntimeContext,
  call: Prompt.ToolCallPart,
) => Effect.Effect<Prompt.ToolResultPart> = Effect.fnUntraced(
  function* (context, call) {
    const tool = yield* context.registry.tool(call.name);
    return yield* toolResult(tool, call);
  },
);

const toolResult = (
  tool: RegisteredTool | undefined,
  call: Prompt.ToolCallPart,
): Effect.Effect<Prompt.ToolResultPart> => {
  /* istanbul ignore next -- Effect AI decodes tool calls against the toolkit. */
  if (tool === undefined) {
    return Effect.succeed(failedResult(call, `Unknown tool: ${call.name}`));
  }
  return Effect.map(Effect.result(tool.execute(call.params)), (result) =>
    result._tag === "Success"
      ? successResult(call, result.success)
      : failedResult(call, result.failure),
  );
};

const callMessage = (call: Prompt.ToolCallPart): Prompt.AssistantMessage =>
  Prompt.assistantMessage({ content: [call] });

const successResult = (
  call: Prompt.ToolCallPart,
  result: unknown,
): Prompt.ToolResultPart =>
  Prompt.toolResultPart({
    id: call.id,
    name: call.name,
    isFailure: false,
    result,
  });

const failedResult = (
  call: Prompt.ToolCallPart,
  result: unknown,
): Prompt.ToolResultPart =>
  Prompt.toolResultPart({
    id: call.id,
    name: call.name,
    isFailure: true,
    result,
  });
