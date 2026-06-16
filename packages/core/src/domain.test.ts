import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import {
  CustomPart,
  FilePart,
  Message,
  Part,
  SessionId,
  TextPart,
  Usage,
} from "./index";

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

it("rejects custom message parts with reserved types", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(Part)({ type: "tool-call", data: {} }),
  );
});

it("rejects custom message parts without the extension prefix", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(CustomPart)({ type: "custom", data: {} }),
  );
});

it("decodes file parts with string data", () => {
  assert.deepStrictEqual(
    Schema.decodeUnknownSync(FilePart)({
      type: "file",
      mediaType: "text/plain",
      data: "hello",
    }),
    {
      type: "file",
      mediaType: "text/plain",
      data: "hello",
    },
  );
});

it("rejects non-file file part data", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(FilePart)({
      type: "file",
      mediaType: "text/plain",
      data: 42,
    }),
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

it("rejects invalid message timestamps", () => {
  for (const createdAt of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() =>
      Schema.decodeUnknownSync(Message)({
        id: "msg_123",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
        createdAt,
      }),
    );
  }
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

it("rejects invalid usage token counts", () => {
  for (const inputTokens of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => Schema.decodeUnknownSync(Usage)({ inputTokens }));
  }
});
