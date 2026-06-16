import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import type { AgentEvent as AgentEventType } from "./index";
import {
  AgentEvent,
  ErrorEvent,
  EventSeq,
  MessageEndEvent,
  PartId,
  RunEndEvent,
  RunStartEvent,
  ToolExecutionDeltaEvent,
  ToolResultEvent,
} from "./index";

type AgentEventKind = AgentEventType["type"];

const allEventKinds: ReadonlyArray<AgentEventKind> = [
  "run-start",
  "run-end",
  "turn-start",
  "turn-end",
  "message-start",
  "message-end",
  "text-start",
  "text-delta",
  "text-end",
  "reasoning-start",
  "reasoning-delta",
  "reasoning-end",
  "tool-input-start",
  "tool-input-delta",
  "tool-input-end",
  "tool-call",
  "tool-execution-start",
  "tool-execution-delta",
  "tool-execution-end",
  "tool-result",
  "usage",
  "diagnostic",
  "error",
];
void allEventKinds;

const baseEvent = {
  runId: "run_123",
  sessionId: "ses_123",
  seq: 0,
};

it("decodes event sequence and part identifiers", () => {
  assert.strictEqual(Schema.decodeUnknownSync(EventSeq)(0), 0);
  assert.strictEqual(Schema.decodeUnknownSync(PartId)("part_123"), "part_123");
});

it("rejects invalid event sequence and part identifiers", () => {
  for (const seq of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => Schema.decodeUnknownSync(EventSeq)(seq));
  }

  assert.throws(() => Schema.decodeUnknownSync(PartId)(""));
});

it("decodes run lifecycle events", () => {
  assert.deepStrictEqual(
    Schema.encodeUnknownSync(RunStartEvent)(
      Schema.decodeUnknownSync(RunStartEvent)({
        ...baseEvent,
        type: "run-start",
        parentRunId: "run_parent",
      }),
    ),
    {
      ...baseEvent,
      type: "run-start",
      parentRunId: "run_parent",
    },
  );

  assert.deepStrictEqual(
    Schema.encodeUnknownSync(RunEndEvent)(
      Schema.decodeUnknownSync(RunEndEvent)({
        ...baseEvent,
        type: "run-end",
        reason: "max-steps",
      }),
    ),
    {
      ...baseEvent,
      type: "run-end",
      reason: "max-steps",
    },
  );

  for (const event of [
    { ...baseEvent, type: "turn-start", step: 0 },
    { ...baseEvent, type: "turn-end", step: 0 },
  ] as const) {
    assert.strictEqual(
      Schema.decodeUnknownSync(AgentEvent)(event).type,
      event.type,
    );
  }
});

it("rejects malformed run lifecycle events", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(RunStartEvent)({
      ...baseEvent,
      type: "run-start",
      parentRunId: undefined,
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(RunEndEvent)({
      ...baseEvent,
      type: "run-end",
      reason: "retry",
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(AgentEvent)({
      ...baseEvent,
      type: "turn-start",
      step: -1,
    }),
  );
});

it("decodes message lifecycle events", () => {
  assert.deepStrictEqual(
    Schema.encodeUnknownSync(AgentEvent)(
      Schema.decodeUnknownSync(AgentEvent)({
        ...baseEvent,
        type: "message-start",
        messageId: "msg_123",
        role: "assistant",
      }),
    ),
    {
      ...baseEvent,
      type: "message-start",
      messageId: "msg_123",
      role: "assistant",
    },
  );

  const messageEnd = Schema.decodeUnknownSync(MessageEndEvent)({
    ...baseEvent,
    type: "message-end",
    message: {
      id: "msg_123",
      role: "assistant",
      parts: [{ type: "text", text: "hello" }],
      createdAt: 1,
    },
  });

  assert.strictEqual(messageEnd.message.parts[0]?.type, "text");
});

it("rejects non-assistant message start events", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(AgentEvent)({
      ...baseEvent,
      type: "message-start",
      messageId: "msg_123",
      role: "user",
    }),
  );
});

it("decodes text and reasoning stream events", () => {
  for (const event of [
    {
      ...baseEvent,
      type: "text-start",
      messageId: "msg_123",
      partId: "part_1",
    },
    {
      ...baseEvent,
      type: "text-delta",
      messageId: "msg_123",
      partId: "part_1",
      delta: "hello",
    },
    { ...baseEvent, type: "text-end", messageId: "msg_123", partId: "part_1" },
    {
      ...baseEvent,
      type: "reasoning-start",
      messageId: "msg_123",
      partId: "part_2",
    },
    {
      ...baseEvent,
      type: "reasoning-delta",
      messageId: "msg_123",
      partId: "part_2",
      delta: "thinking",
    },
    {
      ...baseEvent,
      type: "reasoning-end",
      messageId: "msg_123",
      partId: "part_2",
    },
  ] as const) {
    assert.strictEqual(
      Schema.decodeUnknownSync(AgentEvent)(event).type,
      event.type,
    );
  }
});

it("decodes tool stream and execution events", () => {
  for (const event of [
    {
      ...baseEvent,
      type: "tool-input-start",
      toolCallId: "call_123",
      name: "read",
    },
    {
      ...baseEvent,
      type: "tool-input-delta",
      toolCallId: "call_123",
      delta: '{"filePath":',
    },
    { ...baseEvent, type: "tool-input-end", toolCallId: "call_123" },
    {
      ...baseEvent,
      type: "tool-call",
      toolCallId: "call_123",
      name: "read",
      input: { filePath: "README.md" },
    },
    { ...baseEvent, type: "tool-execution-start", toolCallId: "call_123" },
    {
      ...baseEvent,
      type: "tool-execution-delta",
      toolCallId: "call_123",
      chunk: { bytesRead: 10 },
    },
    { ...baseEvent, type: "tool-execution-end", toolCallId: "call_123" },
  ] as const) {
    assert.strictEqual(
      Schema.decodeUnknownSync(AgentEvent)(event).type,
      event.type,
    );
  }
});

it("decodes tool result events", () => {
  assert.deepStrictEqual(
    Schema.encodeUnknownSync(ToolResultEvent)(
      Schema.decodeUnknownSync(ToolResultEvent)({
        ...baseEvent,
        type: "tool-result",
        toolCallId: "call_123",
        output: { text: "file contents" },
        isError: false,
      }),
    ),
    {
      ...baseEvent,
      type: "tool-result",
      toolCallId: "call_123",
      output: { text: "file contents" },
      isError: false,
    },
  );
});

it("rejects non-json tool event payloads", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(ToolExecutionDeltaEvent)({
      ...baseEvent,
      type: "tool-execution-delta",
      toolCallId: "call_123",
      chunk: () => "nope",
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(ToolResultEvent)({
      ...baseEvent,
      type: "tool-result",
      toolCallId: "call_123",
      output: undefined,
      isError: true,
    }),
  );
});

it("decodes usage, diagnostic, and error events", () => {
  assert.deepStrictEqual(
    Schema.encodeUnknownSync(AgentEvent)(
      Schema.decodeUnknownSync(AgentEvent)({
        ...baseEvent,
        type: "usage",
        usage: { inputTokens: 10, outputTokens: 4 },
      }),
    ),
    {
      ...baseEvent,
      type: "usage",
      usage: { inputTokens: 10, outputTokens: 4 },
    },
  );

  assert.deepStrictEqual(
    Schema.encodeUnknownSync(AgentEvent)(
      Schema.decodeUnknownSync(AgentEvent)({
        ...baseEvent,
        type: "diagnostic",
        level: "warn",
        extension: "ext-test",
        message: "hook failed",
        cause: { detail: "boom" },
      }),
    ),
    {
      ...baseEvent,
      type: "diagnostic",
      level: "warn",
      extension: "ext-test",
      message: "hook failed",
      cause: { detail: "boom" },
    },
  );

  const errorEvent = Schema.decodeUnknownSync(ErrorEvent)({
    ...baseEvent,
    type: "error",
    error: { _tag: "ProviderError", message: "model failed" },
  });

  assert.strictEqual(errorEvent.error._tag, "ProviderError");
});

it("rejects malformed event envelopes", () => {
  assert.throws(() =>
    Schema.decodeUnknownSync(AgentEvent)({
      ...baseEvent,
      type: "unknown",
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(AgentEvent)({
      type: "turn-start",
      runId: "run_123",
      seq: 0,
      step: 0,
    }),
  );

  assert.throws(() =>
    Schema.decodeUnknownSync(AgentEvent)({
      ...baseEvent,
      type: "diagnostic",
      level: "warn",
      extension: "ext-test",
      message: "hook failed",
      cause: undefined,
    }),
  );
});
