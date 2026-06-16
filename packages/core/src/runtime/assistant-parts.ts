// biome-ignore-all lint/suspicious/noUnnecessaryConditions: Biome narrows Response.StreamPart incorrectly.
import { Prompt } from "effect/unstable/ai";

import type { AssistantState, StreamPart } from "./assistant";
import { appendTextDelta, startTextPart } from "./assistant-text";
import { appendToolCall, appendToolResult } from "./assistant-tool";

export const appendAssistantPart = (
  state: AssistantState,
  part: StreamPart,
): void => {
  switch (part.type) {
    case "text-start":
      startTextPart(state, state.text, part.id, Prompt.textPart);
      break;
    case "text-delta":
      appendTextDelta({
        state,
        activeParts: state.text,
        id: part.id,
        delta: part.delta,
        makePart: Prompt.textPart,
      });
      break;
    case "text-end":
      state.text.delete(part.id);
      break;
    case "reasoning-start":
      startTextPart(state, state.reasoning, part.id, Prompt.reasoningPart);
      break;
    case "reasoning-delta":
      appendTextDelta({
        state,
        activeParts: state.reasoning,
        id: part.id,
        delta: part.delta,
        makePart: Prompt.reasoningPart,
      });
      break;
    case "reasoning-end":
      state.reasoning.delete(part.id);
      break;
    case "tool-call":
      appendToolCall(state, part);
      break;
    case "tool-result":
      appendToolResult(state, part);
      break;
    case "tool-approval-request":
      state.content.push(
        Prompt.toolApprovalRequestPart({
          approvalId: part.approvalId,
          toolCallId: part.toolCallId,
        }),
      );
      break;
    case "file":
      state.content.push(
        Prompt.filePart({ mediaType: part.mediaType, data: part.data }),
      );
      break;
    case "tool-params-start":
    case "tool-params-delta":
    case "tool-params-end":
    case "source":
    case "response-metadata":
    case "finish":
      break;
    /* istanbul ignore next -- error parts are failed before this reducer. */
    case "error":
      break;
  }
};
