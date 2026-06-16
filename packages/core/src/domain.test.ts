import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import { CustomPart, Message, SessionId, TextPart, Usage } from "./index";

it("decodes branded ids", () => {
  assert.strictEqual(Schema.decodeUnknownSync(SessionId)("ses_123"), "ses_123");
});

it("decodes known message parts", () => {
  assert.deepStrictEqual(
    Schema.decodeUnknownSync(TextPart)({ type: "text", text: "hello" }),
    {
      type: "text",
      text: "hello",
    },
  );
});

it("decodes custom message parts", () => {
  assert.deepStrictEqual(
    Schema.decodeUnknownSync(CustomPart)({
      type: "x-bash",
      data: { command: "ls" },
    }),
    {
      type: "x-bash",
      data: { command: "ls" },
    },
  );
});

it("decodes canonical messages", () => {
  const message = Schema.decodeUnknownSync(Message)({
    id: "msg_123",
    role: "assistant",
    parts: [
      { type: "reasoning", text: "thinking" },
      {
        type: "tool-call",
        id: "call_123",
        name: "read",
        input: { filePath: "/tmp/a" },
      },
    ],
    metadata: { provider: "test" },
    createdAt: 1,
  });

  assert.strictEqual(message.role, "assistant");
  assert.strictEqual(message.parts.length, 2);
});

it("rejects malformed messages", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(Message)({
      id: "msg_123",
      role: "assistant",
      parts: [{ type: "text" }],
      createdAt: 1,
    }),
  );
});

it("decodes usage reports", () => {
  assert.deepStrictEqual(
    Schema.decodeUnknownSync(Usage)({ inputTokens: 10, outputTokens: 4 }),
    {
      inputTokens: 10,
      outputTokens: 4,
    },
  );
});
