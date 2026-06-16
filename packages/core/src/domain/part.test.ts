import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import { Part } from "./part";

const decode = Schema.decodeUnknownSync(Part);
const encode = Schema.encodeUnknownSync(Part);

/**
 * Decode then re-encode. The encoded form uses unbranded ids, so structural
 * equality against a plain literal type-checks, and identity proves the part
 * decoded into the intended member.
 */
const roundtrip = (input: unknown): unknown => encode(decode(input));

it("decodes a text part", () => {
  assert.deepStrictEqual(roundtrip({ type: "text", text: "hello" }), {
    type: "text",
    text: "hello",
  });
});

it("decodes a reasoning part", () => {
  assert.deepStrictEqual(roundtrip({ type: "reasoning", text: "because" }), {
    type: "reasoning",
    text: "because",
  });
});

it("decodes a file part", () => {
  assert.deepStrictEqual(
    roundtrip({ type: "file", mediaType: "image/png", data: "AAAA" }),
    {
      type: "file",
      mediaType: "image/png",
      data: "AAAA",
    },
  );
});

it("decodes a tool-call part", () => {
  assert.deepStrictEqual(
    roundtrip({
      type: "tool-call",
      id: "tc_1",
      name: "bash",
      input: { cmd: "ls" },
    }),
    {
      type: "tool-call",
      id: "tc_1",
      name: "bash",
      input: { cmd: "ls" },
    },
  );
});

it("decodes a tool-result part", () => {
  assert.deepStrictEqual(
    roundtrip({
      type: "tool-result",
      id: "tc_1",
      name: "bash",
      output: "ok",
      isError: false,
    }),
    {
      type: "tool-result",
      id: "tc_1",
      name: "bash",
      output: "ok",
      isError: false,
    },
  );
});

it("carries an unknown part type opaquely as a custom part", () => {
  assert.deepStrictEqual(
    roundtrip({ type: "x-compaction-summary", data: { kept: 3 } }),
    {
      type: "x-compaction-summary",
      data: { kept: 3 },
    },
  );
});
