import { assert, it } from "@effect/vitest";
import { Schema, SchemaAST } from "effect";

import { AgentEventSchemas } from "./event/agent-event";
import type { AgentEvent as AgentEventType } from "./index";
import * as Root from "./index";
import {
  AgentEvent,
  AssistantMessage,
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
  const fixtures = Object.entries(agentEventFixtures);

  assert.strictEqual(fixtures.length, AgentEventSchemas.length);

  for (const [type, event] of fixtures) {
    assert.strictEqual(Schema.decodeUnknownSync(AgentEvent)(event).type, type);
    assertAgentEventRoundTrip(event);
  }
});

it("exports every agent event schema from the package root", () => {
  const publicRootValues = new Set(Object.values(Root));
  const registeredSchemas: ReadonlySet<unknown> = new Set(AgentEventSchemas);
  const publicEventSchemas = Object.entries(Root)
    .filter(([name]) => name.endsWith("Event") && name !== "AgentEvent")
    .map(([, schema]) => schema);

  for (const schema of AgentEventSchemas) {
    assert.ok(publicRootValues.has(schema));
  }

  assert.strictEqual(publicEventSchemas.length, AgentEventSchemas.length);

  for (const schema of publicEventSchemas) {
    assert.ok(registeredSchemas.has(schema));
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

it("decodes nested message-end messages", () => {
  const messageEnd = Schema.decodeUnknownSync(MessageEndEvent)(
    agentEventFixtures["message-end"],
  );

  assert.strictEqual(messageEnd.message.parts[0]?.type, "text");
  assert.strictEqual(
    Schema.decodeUnknownSync(AssistantMessage)(messageEnd.message).role,
    "assistant",
  );
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

  assert.throws(() =>
    Schema.decodeUnknownSync(MessageEndEvent)({
      ...baseEvent,
      type: "message-end",
      message: {
        id: "msg_123",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
        createdAt: 1,
      },
    }),
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

it("decodes nested terminal errors", () => {
  const errorEvent = Schema.decodeUnknownSync(ErrorEvent)(
    agentEventFixtures.error,
  );

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
