import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import type {
  FilePart as FilePartType,
  MediaType,
  Part as PartType,
  TimestampMillis,
  TokenCount,
  ToolCallPart as ToolCallPartType,
} from "./index";
import {
  CustomPart,
  FilePart,
  Message,
  Part,
  SessionId,
  TextPart,
  ToolCallPart,
  ToolResultPart,
  Usage,
} from "./index";

type TimestampMillisExtendsTokenCount = TimestampMillis extends TokenCount
  ? true
  : false;
type TokenCountExtendsTimestampMillis = TokenCount extends TimestampMillis
  ? true
  : false;

const numericBrandsAreDistinct: [
  TimestampMillisExtendsTokenCount,
  TokenCountExtendsTimestampMillis,
] = [false, false];
void numericBrandsAreDistinct;

type FilePartMediaTypeMatchesMediaType = [
  FilePartType["mediaType"] extends MediaType ? true : false,
  MediaType extends FilePartType["mediaType"] ? true : false,
];
const filePartMediaTypeUsesMediaType: FilePartMediaTypeMatchesMediaType = [
  true,
  true,
];
void filePartMediaTypeUsesMediaType;

const assertToolCallPartNarrowing = (part: PartType): void => {
  if (part.type === "tool-call") {
    const toolCallPart: ToolCallPartType = part;
    void toolCallPart;
  }
};
void assertToolCallPartNarrowing;

it("decodes branded ids", () => {
  assert.strictEqual(Schema.decodeUnknownSync(SessionId)("ses_123"), "ses_123");
});

it("rejects empty branded ids", () => {
  assert.throws(() => Schema.decodeUnknownSync(SessionId)(""));
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

it("rejects custom message parts without an extension suffix", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(CustomPart)({ type: "x-", data: {} }),
  );
});

it("rejects every canonical type as a custom message part", () => {
  for (const type of [
    "text",
    "reasoning",
    "file",
    "tool-call",
    "tool-result",
  ] as const) {
    assert.throws(() =>
      Schema.decodeUnknownSync(CustomPart)({ type, data: {} }),
    );
  }
});

it("rejects non-json custom message part data", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(CustomPart)({
      type: "x-test",
      data: () => "nope",
    }),
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

it("rejects invalid file part media types", () => {
  for (const mediaType of ["", "not-a-mime"]) {
    assert.throws(() =>
      Schema.decodeUnknownSync(FilePart)({
        type: "file",
        mediaType,
        data: "hello",
      }),
    );
  }
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

it("rejects empty tool part names", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(ToolCallPart)({
      type: "tool-call",
      id: "call_123",
      name: "",
      input: {},
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(ToolResultPart)({
      type: "tool-result",
      id: "call_123",
      name: "",
      output: {},
      isError: false,
    }),
  );
});

it("rejects non-json tool call input", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(ToolCallPart)({
      type: "tool-call",
      id: "call_123",
      name: "read",
      input: Symbol("not-json"),
    }),
  );
});

it("rejects non-json tool result output", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(ToolResultPart)({
      type: "tool-result",
      id: "call_123",
      name: "read",
      output: undefined,
      isError: false,
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

it("rejects non-json message metadata", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(Message)({
      id: "msg_123",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
      metadata: { fn: () => "nope" },
      createdAt: 1,
    }),
  );
});

it("rejects explicit undefined message metadata", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(Message)({
      id: "msg_123",
      role: "user",
      parts: [{ type: "text", text: "hello" }],
      metadata: undefined,
      createdAt: 1,
    }),
  );
});

it("decodes usage reports", () => {
  const usage = Schema.decodeUnknownSync(Usage)({
    inputTokens: 10,
    outputTokens: 4,
  });

  assert.strictEqual(usage.inputTokens, 10);
  assert.strictEqual(usage.outputTokens, 4);
});

it("rejects invalid usage token counts", () => {
  for (const inputTokens of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => Schema.decodeUnknownSync(Usage)({ inputTokens }));
  }
});

it("rejects explicit undefined usage token counts", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(Usage)({ inputTokens: undefined }),
  );
});
