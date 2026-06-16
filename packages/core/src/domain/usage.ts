import { Schema } from "effect";

/**
 * Token accounting reported by the provider. Every field is optional because
 * providers expose different subsets. The core never stores `Usage` on a
 * message; it is attached to `usage` events emitted during a run.
 */
export const Usage = Schema.Struct({
  inputTokens: Schema.optionalKey(Schema.Number),
  outputTokens: Schema.optionalKey(Schema.Number),
  reasoningTokens: Schema.optionalKey(Schema.Number),
  cacheReadTokens: Schema.optionalKey(Schema.Number),
  cacheWriteTokens: Schema.optionalKey(Schema.Number),
});

export type Usage = typeof Usage.Type;
