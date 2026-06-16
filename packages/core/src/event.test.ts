import { assert, it } from "@effect/vitest";
import { Schema, SchemaAST } from "effect";

import type { AgentEvent as AgentEventType } from "./index";
import {
  AgentEvent,
  AgentEventSchemas,
  DiagnosticEvent,
  DiagnosticLevel,
  ErrorEvent,
  EventSeq,
  MessageEndEvent,
  PartId,
  RunEndEvent,
  RunStartEvent,
  ToolExecutionDeltaEvent,
  ToolInputEndEvent,
  ToolResultEvent,
} from "./index";

type AgentEventKind = AgentEventType["type"];

const baseEvent = {
  runId: "run_123",
  sessionId: "ses_123",
  seq: 0,
};

const agentEventFixtures: Record<AgentEventKind, unknown> = {
  "run-start": { ...baseEvent, type: "run-start", parentRunId: "run_parent" },
  "run-end": { ...baseEvent, type: "run-end", reason: "max-steps" },
  "turn-start": { ...baseEvent, type: "turn-start", step: 0 },
  "turn-end": { ...baseEvent, type: "turn-end", step: 0 },
  "message-start": {
    ...baseEvent,
    type: "message-start",
    messageId: "msg_123",
    role: "assistant",
  },
  "message-end": {
    ...baseEvent,
    type: "message-end",
    message: {
      id: "msg_123",
      role: "assistant",
      parts: [{ type: "text", text: "hello" }],
      createdAt: 1,
    },
  },
  "text-start": {
    ...baseEvent,
    type: "text-start",
    messageId: "msg_123",
    partId: "part_1",
  },
  "text-delta": {
    ...baseEvent,
    type: "text-delta",
    messageId: "msg_123",
    partId: "part_1",
    delta: "hello",
  },
  "text-end": {
    ...baseEvent,
    type: "text-end",
    messageId: "msg_123",
    partId: "part_1",
  },
  "reasoning-start": {
    ...baseEvent,
    type: "reasoning-start",
    messageId: "msg_123",
    partId: "part_2",
  },
  "reasoning-delta": {
    ...baseEvent,
    type: "reasoning-delta",
    messageId: "msg_123",
    partId: "part_2",
    delta: "thinking",
  },
  "reasoning-end": {
    ...baseEvent,
    type: "reasoning-end",
    messageId: "msg_123",
    partId: "part_2",
  },
  "tool-input-start": {
    ...baseEvent,
    type: "tool-input-start",
    toolCallId: "call_123",
    name: "read",
  },
  "tool-input-delta": {
    ...baseEvent,
    type: "tool-input-delta",
    toolCallId: "call_123",
    delta: '{"filePath":',
  },
  "tool-input-end": {
    ...baseEvent,
    type: "tool-input-end",
    toolCallId: "call_123",
  },
  "tool-call": {
    ...baseEvent,
    type: "tool-call",
    toolCallId: "call_123",
    name: "read",
    input: { filePath: "README.md" },
  },
  "tool-execution-start": {
    ...baseEvent,
    type: "tool-execution-start",
    toolCallId: "call_123",
  },
  "tool-execution-delta": {
    ...baseEvent,
    type: "tool-execution-delta",
    toolCallId: "call_123",
    chunk: { bytesRead: 10 },
  },
  "tool-execution-end": {
    ...baseEvent,
    type: "tool-execution-end",
    toolCallId: "call_123",
  },
  "tool-result": {
    ...baseEvent,
    type: "tool-result",
    toolCallId: "call_123",
    output: { text: "file contents" },
    isError: false,
  },
  usage: {
    ...baseEvent,
    type: "usage",
    usage: { inputTokens: 10, outputTokens: 4 },
  },
  diagnostic: {
    ...baseEvent,
    type: "diagnostic",
    level: "warn",
    extension: "ext-test",
    message: "hook failed",
    cause: { detail: "boom" },
  },
  error: {
    ...baseEvent,
    type: "error",
    error: { _tag: "ProviderError", message: "model failed" },
  },
};

const assertAgentEventRoundTrip = (event: unknown): void => {
  assert.deepStrictEqual(
    Schema.encodeUnknownSync(AgentEvent)(
      Schema.decodeUnknownSync(AgentEvent)(event),
    ),
    event,
  );
};

it("decodes event sequence and part identifiers", () => {
  assert.strictEqual(Schema.decodeUnknownSync(EventSeq)(0), 0);
  assert.strictEqual(Schema.decodeUnknownSync(PartId)("part_123"), "part_123");
});

it("round-trips every registered event fixture", () => {
  const fixtures = Object.values(agentEventFixtures);

  assert.strictEqual(fixtures.length, AgentEventSchemas.length);

  for (const event of fixtures) {
    assertAgentEventRoundTrip(event);
  }
});

it("derives PascalCase schema identifiers from event types", () => {
  assert.strictEqual(
    SchemaAST.resolveIdentifier(ToolInputEndEvent.ast),
    ["Tool", "Input", "End", "Event"].join(""),
  );
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
    assertAgentEventRoundTrip(event);
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
    assertAgentEventRoundTrip(event);
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
    assertAgentEventRoundTrip(event);
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

it("rejects unknown diagnostic levels", () => {
  assert.strictEqual(
    Schema.decodeUnknownSync(DiagnosticLevel)("error"),
    "error",
  );

  assert.throws(() => Schema.decodeUnknownSync(DiagnosticLevel)("banana"));
  assert.throws(() =>
    Schema.decodeUnknownSync(DiagnosticEvent)({
      ...baseEvent,
      type: "diagnostic",
      level: "banana",
      extension: "ext-test",
      message: "hook failed",
    }),
  );
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
