import { Effect } from "effect";
import { Prompt, type Response } from "effect/unstable/ai";

import { appendAssistantPart } from "./assistant-parts";
import { ResponsePartError } from "./errors";

export interface AssistantResult {
  readonly message: Prompt.AssistantMessage;
  readonly toolCalls: ReadonlyArray<Prompt.ToolCallPart>;
}

export type StreamPart =
  | Response.TextStartPart
  | Response.TextDeltaPart
  | Response.TextEndPart
  | Response.ReasoningStartPart
  | Response.ReasoningDeltaPart
  | Response.ReasoningEndPart
  | Response.ToolParamsStartPart
  | Response.ToolParamsDeltaPart
  | Response.ToolParamsEndPart
  | Response.ToolCallPart<string, unknown>
  | Response.ToolResultPart<string, unknown, unknown>
  | Response.ToolApprovalRequestPart
  | Response.FilePart
  | Response.DocumentSourcePart
  | Response.UrlSourcePart
  | Response.ResponseMetadataPart
  | Response.FinishPart
  | Response.ErrorPart;

export interface AssistantState {
  readonly content: Array<Prompt.AssistantMessagePart>;
  readonly toolCalls: Array<Prompt.ToolCallPart>;
  readonly text: Map<string, string>;
  readonly reasoning: Map<string, string>;
}

export const makeAssistantState = (): AssistantState => ({
  content: [],
  toolCalls: [],
  text: new Map(),
  reasoning: new Map(),
});

export const applyAssistantPart = (
  state: AssistantState,
  part: StreamPart,
): Effect.Effect<AssistantState, ResponsePartError> => {
  if (part.type === "error") {
    return Effect.fail(new ResponsePartError({ error: part.error }));
  }
  appendAssistantPart(state, part);
  return Effect.succeed(state);
};

export const finishAssistant = (state: AssistantState): AssistantResult => ({
  message: Prompt.assistantMessage({ content: [...state.content] }),
  toolCalls: [...state.toolCalls],
});
