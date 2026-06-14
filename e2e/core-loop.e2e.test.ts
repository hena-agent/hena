import { afterEach, expect, test } from "vitest";
import type {
  CoreEvent,
  Extension,
  ProviderChunk,
  ProviderRequest,
} from "../packages/core/src/core";
import { createE2EHarness, type E2EHarness } from "./harness";

const harnesses: Array<E2EHarness> = [];

afterEach(async () => {
  await Promise.all(
    harnesses.splice(0).map(async (harness) => {
      await harness.close();
    }),
  );
});

test("streams an agent run over HTTP and SSE", async () => {
  const harness = await makeHarness([scriptedProvider(), doubleTool()]);
  const session = await createSession(harness.url);
  const eventsPromise = collectEvents(
    `${harness.url}/sessions/${session.id}/events`,
  );

  const response = await fetch(`${harness.url}/sessions/${session.id}/prompt`, {
    body: JSON.stringify({ input: "double" }),
    method: "POST",
  });

  expect(response.status).toBe(200);
  const events = await eventsPromise;
  expect(events.map((event) => event.type)).toEqual([
    "user_message",
    "agent_start",
    "turn_start",
    "message_start",
    "message_end",
    "tool_start",
    "tool_end",
    "turn_end",
    "turn_start",
    "message_start",
    "message_delta",
    "message_end",
    "turn_end",
    "agent_end",
  ]);
  expect(events.at(-1)).toMatchObject({ reason: "completed" });
});

test("returns typed HTTP errors for invalid E2E requests", async () => {
  const harness = await makeHarness([scriptedProvider()]);
  const missing = await fetch(`${harness.url}/missing`);
  const sessionMissing = await fetch(`${harness.url}/sessions/missing/events`);
  const session = await createSession(harness.url);
  const invalidPrompt = await fetch(
    `${harness.url}/sessions/${session.id}/prompt`,
    {
      body: JSON.stringify({ input: 1 }),
      method: "POST",
    },
  );
  const unsupportedAction = await fetch(
    `${harness.url}/sessions/${session.id}/unknown`,
  );

  expect(missing.status).toBe(404);
  expect(sessionMissing.status).toBe(404);
  expect(invalidPrompt.status).toBe(400);
  expect(unsupportedAction.status).toBe(404);
});

async function makeHarness(
  extensions: readonly Extension[],
): Promise<E2EHarness> {
  const harness = await createE2EHarness(extensions);
  harnesses.push(harness);
  return harness;
}

async function createSession(
  baseUrl: string,
): Promise<{ readonly id: string }> {
  const response = await fetch(`${baseUrl}/sessions`, { method: "POST" });
  expect(response.status).toBe(201);
  const body: unknown = await response.json();
  if (!isSessionBody(body)) {
    throw new Error("Invalid session response");
  }
  return body;
}

async function collectEvents(url: string): Promise<Array<CoreEvent>> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  if (response.body === null) {
    throw new Error("SSE response body missing");
  }
  const events = await readSse(response.body);
  return events;
}

async function readSse(
  body: ReadableStream<Uint8Array>,
): Promise<Array<CoreEvent>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const events: Array<CoreEvent> = [];
  let buffer = "";
  let reading = true;
  while (reading) {
    const read = await reader.read();
    if (read.done === true) {
      reading = false;
      continue;
    }
    buffer += decoder.decode(read.value, { stream: true });
    buffer = parseFrames(buffer, events);
    if (events.at(-1)?.type === "agent_end") {
      await reader.cancel();
      reading = false;
    }
  }
  return events;
}

function parseFrames(buffer: string, events: Array<CoreEvent>): string {
  let remaining = buffer;
  let boundary = remaining.indexOf("\n\n");
  while (boundary >= 0) {
    const frame = remaining.slice(0, boundary);
    events.push(parseFrame(frame));
    remaining = remaining.slice(boundary + 2);
    boundary = remaining.indexOf("\n\n");
  }
  return remaining;
}

function parseFrame(frame: string): CoreEvent {
  const line = frame.split("\n").find((part) => part.startsWith("data: "));
  if (line === undefined) {
    throw new Error("Invalid SSE frame");
  }
  const decoded: unknown = JSON.parse(line.slice(6));
  if (!isCoreEvent(decoded)) {
    throw new Error("Invalid core event");
  }
  return decoded;
}

function scriptedProvider(): Extension {
  return (api) => {
    api.provideProvider({
      stream: (request: ProviderRequest) =>
        chunkStream(scriptedChunks(request.messages.length)),
    });
  };
}

function scriptedChunks(messageCount: number): readonly ProviderChunk[] {
  if (messageCount === 1) {
    return [
      {
        toolCall: { id: "double_1", input: { value: 7 }, name: "double" },
        type: "tool_call",
      },
      { stopReason: "completed", type: "finish" },
    ];
  }
  return [
    { text: "double result observed", type: "text_delta" },
    { stopReason: "completed", type: "finish" },
  ];
}

function doubleTool(): Extension {
  return (api) => {
    api.registerTool({
      description: "Doubles a number.",
      execute: (input) => ({
        text: String(readValue(input) * 2),
        type: "text",
      }),
      name: "double",
      parameters: { type: "object" },
    });
  };
}

function chunkStream(
  chunks: readonly ProviderChunk[],
): AsyncIterable<ProviderChunk> {
  return makeChunkStream(chunks);
}

async function* makeChunkStream(chunks: readonly ProviderChunk[]) {
  await Promise.resolve();
  yield* chunks;
}

function readValue(input: unknown): number {
  if (isRecord(input) && typeof input.value === "number") {
    return input.value;
  }
  return 0;
}

function isSessionBody(value: unknown): value is { readonly id: string } {
  return isRecord(value) && typeof value.id === "string";
}

function isCoreEvent(value: unknown): value is CoreEvent {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    typeof value.sessionId === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
