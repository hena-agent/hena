import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import { Usage } from "./usage";

it("decodes a fully-specified usage record", () => {
  const usage = Schema.decodeUnknownSync(Usage)({
    inputTokens: 10,
    outputTokens: 20,
    reasoningTokens: 5,
    cacheReadTokens: 1,
    cacheWriteTokens: 2,
  });
  assert.deepStrictEqual(usage, {
    inputTokens: 10,
    outputTokens: 20,
    reasoningTokens: 5,
    cacheReadTokens: 1,
    cacheWriteTokens: 2,
  });
});

it("treats every field as optional", () => {
  assert.deepStrictEqual(Schema.decodeUnknownSync(Usage)({}), {});
});
