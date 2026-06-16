import { Prompt, type Response } from "effect/unstable/ai";

import type { AssistantState } from "./assistant";

export type TextPart =
  | Response.TextStartPart
  | Response.TextDeltaPart
  | Response.TextEndPart;

export type ReasoningPart =
  | Response.ReasoningStartPart
  | Response.ReasoningDeltaPart
  | Response.ReasoningEndPart;

export const appendTextPart = (state: AssistantState, part: TextPart): void => {
  if (part.type === "text-start") {
    state.text.set(part.id, "");
    return;
  }
  if (part.type === "text-delta") {
    appendTextDelta(state, part);
    return;
  }
  appendActiveText(state, part.id);
};

export const appendReasoningPart = (
  state: AssistantState,
  part: ReasoningPart,
): void => {
  if (part.type === "reasoning-start") {
    state.reasoning.set(part.id, "");
    return;
  }
  if (part.type === "reasoning-delta") {
    appendReasoningDelta(state, part);
    return;
  }
  appendActiveReasoning(state, part.id);
};

const appendTextDelta = (
  state: AssistantState,
  part: Response.TextDeltaPart,
): void => {
  const text = state.text.get(part.id);
  if (text !== undefined) {
    state.text.set(part.id, `${text}${part.delta}`);
    return;
  }
  state.content.push(Prompt.textPart({ text: part.delta }));
};

const appendReasoningDelta = (
  state: AssistantState,
  part: Response.ReasoningDeltaPart,
): void => {
  const reasoning = state.reasoning.get(part.id);
  if (reasoning !== undefined) {
    state.reasoning.set(part.id, `${reasoning}${part.delta}`);
    return;
  }
  state.content.push(Prompt.reasoningPart({ text: part.delta }));
};

const appendActiveText = (state: AssistantState, id: string): void => {
  const text = state.text.get(id);
  if (text === undefined) {
    return;
  }
  state.content.push(Prompt.textPart({ text }));
  state.text.delete(id);
};

const appendActiveReasoning = (state: AssistantState, id: string): void => {
  const reasoning = state.reasoning.get(id);
  if (reasoning === undefined) {
    return;
  }
  state.content.push(Prompt.reasoningPart({ text: reasoning }));
  state.reasoning.delete(id);
};
