import { Effect } from "effect";
import { Prompt, Response, type Tool } from "effect/unstable/ai";

import type { RuntimeContext } from "./context";
import { RuntimeEvent } from "./events";

export const publishToolResult = (
  context: RuntimeContext,
  call: Prompt.ToolCallPart,
  result: Tool.HandlerResult<Tool.Any>,
): Effect.Effect<Prompt.ToolResultPart> => {
  const responsePart = Response.toolResultPart({
    id: call.id,
    name: call.name,
    providerExecuted: false,
    isFailure: result.isFailure,
    result: result.result,
    encodedResult: result.encodedResult,
    preliminary: result.preliminary,
  });
  const promptPart = Prompt.toolResultPart({
    id: call.id,
    name: call.name,
    isFailure: result.isFailure,
    result: result.encodedResult,
  });

  return Effect.as(
    context.events.publish(RuntimeEvent.toolEnd(responsePart)),
    promptPart,
  );
};
