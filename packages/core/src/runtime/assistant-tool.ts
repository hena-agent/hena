import { Prompt, type Response } from "effect/unstable/ai";

import type { AssistantState } from "./assistant";

export const appendToolCall = (
  state: AssistantState,
  part: Response.ToolCallPart<string, unknown>,
): void => {
  const call = Prompt.toolCallPart({
    id: part.id,
    name: part.name,
    params: part.params,
    providerExecuted: part.providerExecuted,
  });
  state.content.push(call);
  state.toolCalls.push(call);
};

export const appendToolResult = (
  state: AssistantState,
  part: Response.ToolResultPart<string, unknown, unknown>,
): void => {
  if (part.preliminary === true) {
    return;
  }
  state.content.push(
    Prompt.toolResultPart({
      id: part.id,
      name: part.name,
      isFailure: part.isFailure,
      result: part.encodedResult,
    }),
  );
};
