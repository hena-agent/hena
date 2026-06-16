import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import { Message } from "./message";

const decode = Schema.decodeUnknownSync(Message);
const encode = Schema.encodeUnknownSync(Message);
const roundtrip = (input: unknown): unknown => encode(decode(input));

it("decodes an assistant message with parts", () => {
  const input = {
    id: "msg_1",
    role: "assistant",
    parts: [{ type: "text", text: "hi" }],
    createdAt: 1000,
  };
  assert.deepStrictEqual(roundtrip(input), input);
});

it("accepts optional metadata", () => {
  const message = decode({
    id: "msg_2",
    role: "user",
    parts: [],
    metadata: { source: "cli" },
    createdAt: 2000,
  });
  assert.deepStrictEqual(message.metadata, { source: "cli" });
});

it("rejects an unknown role", () => {
  assert.throws(() =>
    decode({ id: "msg_3", role: "robot", parts: [], createdAt: 3000 }),
  );
});
