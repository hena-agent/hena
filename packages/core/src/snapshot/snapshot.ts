import type { Prompt, Response } from "effect/unstable/ai";

export interface RuntimeSnapshot {
  readonly prompt: Prompt.Prompt;
  readonly text: string;
  readonly toolResults: ReadonlyArray<
    Response.ToolResultPart<string, unknown, unknown>
  >;
}

const textFromPart = (part: Response.AnyPart): string =>
  part.type === "text-delta" ? part.delta : "";

const isToolResultPart = (
  part: Response.AnyPart,
): part is Response.ToolResultPart<string, unknown, unknown> =>
  part.type === "tool-result";

export const makeSnapshot = (
  prompt: Prompt.Prompt,
  parts: ReadonlyArray<Response.AnyPart>,
): RuntimeSnapshot => ({
  prompt,
  text: parts.map(textFromPart).join(""),
  toolResults: parts.filter(isToolResultPart),
});
