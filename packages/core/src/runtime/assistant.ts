import { Effect } from "effect";
import { Prompt, type Response, type Tool } from "effect/unstable/ai";

import { appendAssistantPart } from "./assistant-parts";
import { ResponsePartError } from "./errors";

export interface AssistantResult {
  readonly message: Prompt.AssistantMessage;
  readonly toolCalls: ReadonlyArray<Prompt.ToolCallPart>;
}

export type StreamPart = Response.StreamPart<Record<string, Tool.Any>>;

export interface ActiveTextPart {
  readonly index: number;
  readonly text: string;
}

export interface AssistantState {
  readonly content: Array<Prompt.AssistantMessagePart>;
  readonly toolCalls: Array<Prompt.ToolCallPart>;
  readonly text: Map<string, ActiveTextPart>;
  readonly reasoning: Map<string, ActiveTextPart>;
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
