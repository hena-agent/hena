import { Prompt, type Response, type Tool } from "effect/unstable/ai";

export interface AssistantResult {
  readonly message: Prompt.AssistantMessage;
  readonly toolCalls: ReadonlyArray<Prompt.ToolCallPart>;
}

type StreamPart = Response.StreamPart<Record<string, Tool.Any>>;

const appendPart = (
  content: ReadonlyArray<Prompt.AssistantMessagePart>,
  part: StreamPart,
): ReadonlyArray<Prompt.AssistantMessagePart> => {
  if (part.type === "text-delta") {
    return [...content, Prompt.textPart({ text: part.delta })];
  }
  if (part.type === "tool-call") {
    return [
      ...content,
      Prompt.toolCallPart({
        id: part.id,
        name: part.name,
        params: part.params,
        providerExecuted: part.providerExecuted,
      }),
    ];
  }
  return content;
};

const isToolCall = (
  part: Prompt.AssistantMessagePart,
): part is Prompt.ToolCallPart => part.type === "tool-call";

export const collectAssistant = (
  parts: ReadonlyArray<StreamPart>,
): AssistantResult => {
  const content = parts.reduce(appendPart, []);

  return {
    message: Prompt.assistantMessage({ content }),
    toolCalls: content.filter(isToolCall),
  };
};
