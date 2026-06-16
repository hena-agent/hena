import { Prompt, type Response } from "effect/unstable/ai";

import type { AssistantState } from "./assistant";

type AssistantNonTextPart =
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
  | Response.FinishPart;

export const appendNonTextPart = (
  state: AssistantState,
  part: AssistantNonTextPart,
): void => {
  switch (part.type) {
    case "tool-call": {
      appendToolCall(state, part);
      break;
    }
    case "tool-result": {
      appendToolResult(state, part);
      break;
    }
    case "tool-approval-request": {
      state.content.push(
        Prompt.toolApprovalRequestPart({
          approvalId: part.approvalId,
          toolCallId: part.toolCallId,
        }),
      );
      break;
    }
    case "file": {
      state.content.push(
        Prompt.filePart({ mediaType: part.mediaType, data: part.data }),
      );
      break;
    }
    case "tool-params-start":
    case "tool-params-delta":
    case "tool-params-end":
    case "source":
    case "response-metadata":
    case "finish": {
      break;
    }
  }
};

const appendToolCall = (
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

const appendToolResult = (
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
