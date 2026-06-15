import { Effect, type Ref } from "effect";
import { Prompt } from "effect/unstable/ai";

import type { Entry } from "./entry";
import type { EventLog } from "./events";
import type { Registry } from "./registry";
import type { RegisteredTool } from "./tool";
import { appendEntry } from "./transcript";

interface ToolContext {
  readonly entries: Ref.Ref<ReadonlyArray<Entry>>;
  readonly events: EventLog;
  readonly registry: Registry;
}

export const runTool = (
  context: ToolContext,
  call: Prompt.ToolCallPart,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* context.events.publish({
      type: "tool_start",
      entry: callMessage(call),
    });
    const tool = yield* context.registry.tool(call.name);
    const part = yield* toolResult(tool, call);
    const message = Prompt.toolMessage({ content: [part] });

    yield* appendEntry(context.entries, message);
    yield* context.events.publish({ type: "tool_end", entry: message });
  });

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
