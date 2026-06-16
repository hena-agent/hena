import { Schema } from "effect";

import { ToolCallId } from "./id";

/**
 * The content parts that make up a {@link Message}.
 *
 * The union is intentionally **open**: known parts decode to their specific
 * shape, while any unrecognized `type` falls through to {@link CustomPart} and
 * is carried opaquely. This lets extensions (compaction summaries, bash
 * transcripts, sub-agent traces) store artifacts in the transcript; the
 * provider extension is responsible for dropping non-model parts before a
 * model call.
 */

/** Plain assistant/user text. */
export const TextPart = Schema.Struct({
  type: Schema.Literal("text"),
  text: Schema.String,
});

/** Model reasoning / thinking content. */
export const ReasoningPart = Schema.Struct({
  type: Schema.Literal("reasoning"),
  text: Schema.String,
});

/** Binary/inline content referenced by media type (data is base64 or a URL). */
export const FilePart = Schema.Struct({
  type: Schema.Literal("file"),
  mediaType: Schema.String,
  data: Schema.String,
});

/** A tool invocation requested by the model. */
export const ToolCallPart = Schema.Struct({
  type: Schema.Literal("tool-call"),
  id: ToolCallId,
  name: Schema.String,
  input: Schema.Unknown,
});

/** The result of executing a {@link ToolCallPart}. */
export const ToolResultPart = Schema.Struct({
  type: Schema.Literal("tool-result"),
  id: ToolCallId,
  name: Schema.String,
  output: Schema.Unknown,
  isError: Schema.Boolean,
});

/**
 * Open extension space. By convention `type` uses an `x-` prefix, but any
 * unknown `type` decodes here so the core can forward it without interpreting
 * it.
 */
export const CustomPart = Schema.Struct({
  type: Schema.String,
  data: Schema.Unknown,
});

/**
 * The part union. Members are ordered so that specific parts win; `CustomPart`
 * is the final fallback (the union decodes with `anyOf` / first-match).
 */
export const Part = Schema.Union([
  TextPart,
  ReasoningPart,
  FilePart,
  ToolCallPart,
  ToolResultPart,
  CustomPart,
]);

export type Part = typeof Part.Type;
