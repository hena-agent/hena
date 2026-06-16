import type { Response } from "effect/unstable/ai";
import type { AssistantState, StreamPart } from "./assistant";
import { appendNonTextPart } from "./assistant-non-text";
import {
  appendReasoningPart,
  appendTextPart,
  type ReasoningPart,
  type TextPart,
} from "./assistant-text";

type AssistantStreamPart = Exclude<StreamPart, Response.ErrorPart>;

export const appendAssistantPart = (
  state: AssistantState,
  part: AssistantStreamPart,
): void => {
  if (isTextPart(part)) {
    appendTextPart(state, part);
    return;
  }
  if (isReasoningPart(part)) {
    appendReasoningPart(state, part);
    return;
  }
  appendNonTextPart(state, part);
};

const isTextPart = (part: AssistantStreamPart): part is TextPart =>
  part.type === "text-start" ||
  part.type === "text-delta" ||
  part.type === "text-end";

const isReasoningPart = (part: AssistantStreamPart): part is ReasoningPart =>
  part.type === "reasoning-start" ||
  part.type === "reasoning-delta" ||
  part.type === "reasoning-end";
