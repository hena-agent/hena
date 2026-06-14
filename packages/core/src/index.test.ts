import { Effect } from "effect";
import { afterEach, expect, test } from "vitest";
import {
  type EventSessions,
  eventSessionIterable,
  publishEventToSession,
  registerEventSession,
  shutdownEventSessions,
  unregisterEventSession,
} from "./event-log";
import {
  type AssistantPart,
  type CoreEvent,
  corePackageName,
  createRuntime,
  type Extension,
  type ExtensionAPI,
  errorFromUnknown,
  type HenaRuntime,
  type ProviderChunk,
  type ProviderRequest,
  type ToolDefinition,
  type TranscriptEntry,
} from "./index";

test("exposes the core package name", () => {
  expect(corePackageName).toBe("@hena-dev/core");
});

const runtimes: Array<HenaRuntime> = [];

afterEach(async () => {
  const disposals = runtimes.splice(0).map(async (runtime) => {
    await runtime.dispose();
  });
  await Promise.all(disposals);
});

test("runs a prompt through a provider extension", async () => {
  const runtime = await makeRuntime([textProvider("hello from model")]);
  const session = runtime.createSession();
  const eventsPromise = collectUntilEnd(session.events);

  await session.prompt("hello");

  const events = await eventsPromise;
  expect(eventTypes(events)).toEqual([
    "user_message",
    "agent_start",
    "turn_start",
    "message_start",
    "message_delta",
    "message_end",
    "turn_end",
    "agent_end",
  ]);
  expect(session.transcript().map((entry) => entry.role)).toEqual([
    "user",
    "assistant",
  ]);
  expect(session.transcript()[1]).toMatchObject({
    role: "assistant",
    parts: [{ text: "hello from model", type: "text" }],
    stopReason: "completed",
  });
});

test("coalesces streamed text deltas into one assistant part", async () => {
  const chunks = ["hello", " ", "from", " stream"];
  const runtime = await makeRuntime([multiTextProvider(chunks)]);
  const session = runtime.createSession();
  const eventsPromise = collectUntilEnd(session.events);

  await session.prompt("hello");

  const events = await eventsPromise;
  expect(messageDeltas(events)).toEqual(chunks);
  expect(assistantParts(session.transcript()[1])).toEqual([
    { text: "hello from stream", type: "text" },
  ]);
});

test("dispatches extension-registered tools and continues the loop", async () => {
  const runtime = await makeRuntime([toolProvider(), doubleTool()]);
  const session = runtime.createSession();
  const eventsPromise = collectUntilEnd(session.events);

  await session.prompt("double five");

  const events = await eventsPromise;
  expect(eventTypes(events)).toEqual([
    "user_message",
    "agent_start",
    "turn_start",
    "message_start",
    "message_delta",
    "message_end",
    "tool_start",
    "tool_update",
    "tool_end",
    "turn_end",
    "turn_start",
    "message_start",
    "message_delta",
    "message_end",
    "turn_end",
    "agent_end",
  ]);
  expect(session.transcript().map((entry) => entry.role)).toEqual([
    "user",
    "assistant",
    "tool_result",
    "assistant",
  ]);
  expect(session.transcript()[2]).toMatchObject({
    content: { text: "10", type: "text" },
    isError: false,
    role: "tool_result",
    toolCallId: "call_1",
  });
  expect(session.transcript()[3]).toMatchObject({
    parts: [{ text: "tool returned 10", type: "text" }],
    role: "assistant",
  });
  expect(messageDeltas(events)).toEqual(["calling double", "tool returned 10"]);
});

test("supports event observers from extensions", async () => {
  const observed: Array<string> = [];
  const observer: Extension = (api) => {
    api.on("event", () => {
      throw new Error("observer failures are contained");
    });
    api.on("agent_end", (event) => {
      observed.push(event.type);
    });
  };
  const runtime = await makeRuntime([textProvider("observed"), observer]);
  const session = runtime.createSession();

  await session.prompt("hello");

  expect(observed).toEqual(["agent_end"]);
});

test("rejects runtime creation without a provider extension", async () => {
  await expect(createRuntime({ extensions: [] })).rejects.toThrow(
    "A provider extension is required",
  );
});

test("rejects invalid max turn configuration", async () => {
  await expect(
    createRuntime({ extensions: [textProvider("unused")], maxTurns: 0 }),
  ).rejects.toThrow("maxTurns must be a positive integer");
});

test("rejects duplicate extension tool names", async () => {
  await expect(
    createRuntime({
      extensions: [textProvider("unused"), noopTool(), noopTool()],
    }),
  ).rejects.toThrow("Duplicate tool name: noop");
});

test("closes extension registration after setup", async () => {
  let captured: ExtensionAPI | undefined;
  await makeRuntime([
    textProvider("unused"),
    (api) => {
      captured = api;
    },
  ]);
  const extensionApi = captured;
  if (extensionApi === undefined) {
    throw new Error("Expected extension API to be captured");
  }

  expect(() => {
    extensionApi.registerTool({
      description: "Late tool.",
      execute: () => ({ text: "late", type: "text" }),
      name: "late",
      parameters: { type: "object" },
    });
  }).toThrow("Extension registration is closed");
});

test("runtime disposal is idempotent and closes session creation", async () => {
  const runtime = await makeRuntime([textProvider("unused")]);

  await runtime.dispose();
  await runtime.dispose();

  expect(() => runtime.createSession()).toThrow("Runtime is disposed");
});

test("rejects a second prompt while a run is active", async () => {
  const runtime = await makeRuntime([abortableProvider()]);
  const session = runtime.createSession();
  const started = waitForEvent(session.events, "message_delta");
  const running = session.prompt("first");

  await started;

  await expect(session.prompt("second")).rejects.toThrow(
    "Session already has an active run",
  );
  session.abort();
  await running;
});

test("disposes sessions and rejects further prompts", async () => {
  const runtime = await makeRuntime([textProvider("unused")]);
  const session = runtime.createSession();

  await session.dispose();
  await session.dispose();

  await expect(session.prompt("after dispose")).rejects.toThrow(
    "Session is disposed",
  );
});

test("disposing an active session aborts the run", async () => {
  const runtime = await makeRuntime([abortableProvider()]);
  const session = runtime.createSession();
  const started = waitForEvent(session.events, "message_delta");
  const running = session.prompt("dispose active");

  await started;
  await session.dispose();
  await running;

  expect(lastEvent(await collectUntilEnd(session.events))).toMatchObject({
    reason: "aborted",
    type: "agent_end",
  });
});

test("returns an error result for unknown tools", async () => {
  const runtime = await makeRuntime([unknownToolProvider()]);
  const session = runtime.createSession();

  await session.prompt("unknown");

  expect(session.transcript()[2]).toMatchObject({
    content: { text: "Unknown tool: missing", type: "text" },
    isError: true,
    role: "tool_result",
  });
});

test("validates standard-schema tool inputs", async () => {
  const runtime = await makeRuntime([validationProvider(), standardTools()]);
  const session = runtime.createSession();

  await session.prompt("validate");

  expect(session.transcript()[2]).toMatchObject({
    content: { text: "9", type: "text" },
    isError: false,
  });
  expect(session.transcript()[3]).toMatchObject({
    content: { text: "value is required", type: "text" },
    isError: true,
  });
  expect(session.transcript()[4]).toMatchObject({
    content: { text: "Invalid tool input", type: "text" },
    isError: true,
  });
  expect(session.transcript()[5]).toMatchObject({
    content: { text: "schema exploded", type: "text" },
    isError: true,
  });
});

test("sends provider-facing tool schemas without runtime validators", async () => {
  const seen: ToolDefinition[][] = [];
  const runtime = await makeRuntime([capturingProvider(seen), standardTools()]);
  const session = runtime.createSession();

  await session.prompt("schemas");

  expect(seen[0]?.map((tool) => tool.parameters)).toEqual([
    { type: "object" },
    { type: "object" },
  ]);
  expect(JSON.stringify(seen)).not.toContain("~standard");
});

test("turns tool failures into tool results", async () => {
  const runtime = await makeRuntime([failingToolProvider(), failingTool()]);
  const session = runtime.createSession();

  await session.prompt("run failing tool");

  expect(session.transcript()[2]).toMatchObject({
    isError: true,
    role: "tool_result",
    toolCallId: "call_1",
  });
  expect(session.transcript()[3]).toMatchObject({
    parts: [{ text: "saw tool failure", type: "text" }],
    role: "assistant",
  });
});

test("normalizes provider error finishes as data", async () => {
  const runtime = await makeRuntime([providerError()]);
  const session = runtime.createSession();
  const eventsPromise = collectUntilEnd(session.events);

  await session.prompt("fail");

  const events = await eventsPromise;
  expect(lastEvent(events)).toMatchObject({
    reason: "error",
    type: "agent_end",
  });
  expect(session.transcript()[1]).toMatchObject({
    role: "assistant",
    stopReason: "error",
  });
});

test("normalizes provider stream throws as data", async () => {
  const runtime = await makeRuntime([
    providerThrows(new Error("provider blew up")),
  ]);
  const session = runtime.createSession();

  await session.prompt("fail");

  expect(session.transcript()[1]).toMatchObject({
    error: { message: "provider blew up" },
    stopReason: "error",
  });
});

test("normalizes provider stream creation throws as data", async () => {
  const runtime = await makeRuntime([providerStreamCreationThrows()]);
  const session = runtime.createSession();

  await session.prompt("fail before stream");

  expect(session.transcript()[1]).toMatchObject({
    error: { message: "stream setup failed" },
    stopReason: "error",
  });
});

test("classifies non-error thrown values", () => {
  expect(errorFromUnknown("string failure")).toEqual({
    category: "unknown",
    message: "string failure",
  });
  expect(errorFromUnknown({})).toEqual({
    category: "unknown",
    message: "Unknown error",
  });
});

test("treats a provider stream ending without finish as completed", async () => {
  const runtime = await makeRuntime([providerEndsWithoutFinish()]);
  const session = runtime.createSession();

  await session.prompt("no finish");

  expect(session.transcript()[1]).toMatchObject({
    parts: [{ text: "done by iterator", type: "text" }],
    stopReason: "completed",
  });
});

test("closes provider streams after a finish chunk", async () => {
  let closed = false;
  const runtime = await makeRuntime([
    providerWithFinally(() => {
      closed = true;
    }),
  ]);
  const session = runtime.createSession();

  await session.prompt("close stream");

  expect(closed).toBe(true);
});

test("ignores provider cleanup failures", async () => {
  const runtime = await makeRuntime([providerWithFailingCleanup()]);
  const session = runtime.createSession();

  await session.prompt("cleanup failure");

  expect(session.transcript()[1]).toMatchObject({
    role: "assistant",
    stopReason: "completed",
  });
});

test("aborts an active run", async () => {
  const runtime = await makeRuntime([abortableProvider()]);
  const session = runtime.createSession();
  const messageStarted = waitForEvent(session.events, "message_delta");
  const eventsPromise = collectUntilEnd(session.events);
  const promptPromise = session.prompt("stop");

  await messageStarted;
  session.abort();
  await promptPromise;

  const events = await eventsPromise;
  expect(lastEvent(events)).toMatchObject({
    reason: "aborted",
    type: "agent_end",
  });
});

test("aborts a running tool", async () => {
  const runtime = await makeRuntime([abortableToolProvider(), abortableTool()]);
  const session = runtime.createSession();
  const toolStarted = waitForEvent(session.events, "tool_start");
  const eventsPromise = collectUntilEnd(session.events);
  const promptPromise = session.prompt("stop tool");

  await toolStarted;
  session.abort();
  await promptPromise;

  const events = await eventsPromise;
  expect(lastEvent(events)).toMatchObject({
    reason: "aborted",
    type: "agent_end",
  });
  expect(session.transcript()[2]).toMatchObject({
    content: { text: "tool aborted", type: "text" },
    isError: false,
    role: "tool_result",
  });
});

test("stops looping tool calls at the configured max turn count", async () => {
  const runtime = await makeRuntime([loopingToolProvider(), noopTool()], {
    maxTurns: 2,
  });
  const session = runtime.createSession();
  const eventsPromise = collectUntilEnd(session.events);

  await session.prompt("loop forever");

  const events = await eventsPromise;
  expect(lastEvent(events)).toMatchObject({
    reason: "max_turns",
    type: "agent_end",
  });
  expect(events.filter((event) => event.type === "turn_start")).toHaveLength(2);
  expect(
    session.transcript().filter((entry) => entry.role === "tool_result"),
  ).toHaveLength(2);
});

test("replays all buffered events without cross-session leakage", async () => {
  const runtime = await makeRuntime([promptSizedProvider()]);
  const quiet = runtime.createSession();
  const flood = runtime.createSession();

  await quiet.prompt("quiet");
  await flood.prompt("flood");

  const quietEvents = await withTimeout(collectUntilEnd(quiet.events), 1_000);
  const floodEvents = await withTimeout(collectUntilEnd(flood.events), 1_000);
  expect(eventTypes(quietEvents)).toEqual([
    "user_message",
    "agent_start",
    "turn_start",
    "message_start",
    "message_delta",
    "message_end",
    "turn_end",
    "agent_end",
  ]);
  expect(quietEvents.every((event) => event.sessionId === quiet.id)).toBe(true);
  expect(floodEvents.every((event) => event.sessionId === flood.id)).toBe(true);
  expect(messageDeltas(floodEvents)).toHaveLength(300);
  expect(assistantParts(flood.transcript()[1])).toHaveLength(1);
  expect(lastEvent(quietEvents)).toMatchObject({ reason: "completed" });
  expect(lastEvent(floodEvents)).toMatchObject({ reason: "completed" });
});

test("event iterators close pending reads on return and session shutdown", async () => {
  const sessions: EventSessions = new Map();
  Effect.runSync(registerEventSession(sessions, "events"));
  const events = Effect.runSync(eventSessionIterable(sessions, "events"));
  const iterator = events[Symbol.asyncIterator]();
  const pending = iterator.next();

  expect(await iterator.return?.()).toEqual({ done: true, value: undefined });
  expect(await withTimeout(pending, 1_000)).toEqual({
    done: true,
    value: undefined,
  });

  const closing = events[Symbol.asyncIterator]();
  const closingPending = closing.next();
  Effect.runSync(unregisterEventSession(sessions, "events"));
  expect(await withTimeout(closingPending, 1_000)).toEqual({
    done: true,
    value: undefined,
  });
});

test("event iterators handle missing sessions and shutdown", async () => {
  const sessions: EventSessions = new Map();
  const missing = Effect.runSync(eventSessionIterable(sessions, "missing"));
  const missingIterator = missing[Symbol.asyncIterator]();

  expect(await missingIterator.next()).toEqual({
    done: true,
    value: undefined,
  });
  expect(await missingIterator.next()).toEqual({
    done: true,
    value: undefined,
  });
  Effect.runSync(publishEventToSession(sessions, mockEvent("missing")));
  Effect.runSync(unregisterEventSession(sessions, "missing"));
  Effect.runSync(registerEventSession(sessions, "shutdown"));
  Effect.runSync(publishEventToSession(sessions, mockEvent("shutdown")));
  Effect.runSync(shutdownEventSessions(sessions));
  expect(sessions.size).toBe(0);
});

async function makeRuntime(
  extensions: ReadonlyArray<Extension>,
  options: { readonly maxTurns?: number } = {},
): Promise<HenaRuntime> {
  const runtime = await createRuntime({ ...options, extensions });
  runtimes.push(runtime);
  return runtime;
}

async function collectUntilEnd(
  events: AsyncIterable<CoreEvent>,
): Promise<Array<CoreEvent>> {
  const collected: Array<CoreEvent> = [];
  for await (const event of events) {
    collected.push(event);
    if (event.type === "agent_end") {
      return collected;
    }
  }
  return collected;
}

async function waitForEvent(
  events: AsyncIterable<CoreEvent>,
  type: CoreEvent["type"],
): Promise<CoreEvent> {
  for await (const event of events) {
    if (event.type === type) {
      return event;
    }
  }
  throw new Error(`Event ${type} was not emitted`);
}

function eventTypes(
  events: ReadonlyArray<CoreEvent>,
): Array<CoreEvent["type"]> {
  return events.map((event) => event.type);
}

function messageDeltas(events: ReadonlyArray<CoreEvent>): Array<string> {
  return events.flatMap((event) =>
    event.type === "message_delta" ? [event.text] : [],
  );
}

function lastEvent(events: ReadonlyArray<CoreEvent>): CoreEvent {
  const last = events.at(-1);
  if (last === undefined) {
    throw new Error("Expected at least one event");
  }
  return last;
}

function assistantParts(
  entry: TranscriptEntry | undefined,
): readonly AssistantPart[] {
  if (entry?.role !== "assistant") {
    throw new Error("Expected an assistant transcript entry");
  }
  return entry.parts;
}

function mockEvent(sessionId: string): CoreEvent {
  return {
    schemaVersion: 1,
    sequence: 1,
    sessionId,
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "agent_start",
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for events"));
        }, ms);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
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

async function* throwingStream(error: unknown) {
  await Promise.resolve();
  if (error instanceof Error) {
    throw error;
  }
  yield { stopReason: "completed", type: "finish" } satisfies ProviderChunk;
}

function textProvider(text: string): Extension {
  return (api) => {
    api.provideProvider({
      stream: () =>
        chunkStream([
          { text, type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]),
    });
  };
}

function multiTextProvider(chunks: readonly string[]): Extension {
  return (api) => {
    api.provideProvider({
      stream: () =>
        chunkStream([
          ...chunks.map((text) => ({ text, type: "text_delta" }) as const),
          { stopReason: "completed", type: "finish" },
        ]),
    });
  };
}

function providerWithFinally(onClose: () => void): Extension {
  return (api) => {
    api.provideProvider({
      stream: async function* () {
        try {
          await Promise.resolve();
          yield { text: "done", type: "text_delta" };
          yield { stopReason: "completed", type: "finish" };
        } finally {
          onClose();
        }
      },
    });
  };
}

function providerWithFailingCleanup(): Extension {
  return (api) => {
    api.provideProvider({
      stream: async function* () {
        try {
          await Promise.resolve();
          yield { stopReason: "completed", type: "finish" };
        } finally {
          await failingCleanup();
        }
      },
    });
  };
}

async function failingCleanup(): Promise<void> {
  await Promise.reject(new Error("cleanup failed"));
}

function toolProvider(): Extension {
  let calls = 0;
  return (api) => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            { text: "calling double", type: "text_delta" },
            {
              toolCall: { id: "call_1", input: { value: 5 }, name: "double" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "tool returned 10", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
}

function unknownToolProvider(): Extension {
  let calls = 0;
  return (api) => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "call_1", input: {}, name: "missing" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "continued", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
}

function validationProvider(): Extension {
  let calls = 0;
  return (api) => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "valid", input: { value: 3 }, name: "triple" },
              type: "tool_call",
            },
            {
              toolCall: { id: "message", input: {}, name: "triple" },
              type: "tool_call",
            },
            {
              toolCall: {
                id: "fallback",
                input: { fallback: true },
                name: "triple",
              },
              type: "tool_call",
            },
            {
              toolCall: { id: "boom", input: {}, name: "schema-boom" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "validated", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
}

function failingToolProvider(): Extension {
  let calls = 0;
  return (api) => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "call_1", input: {}, name: "boom" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "saw tool failure", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
}

function providerError(): Extension {
  return (api) => {
    api.provideProvider({
      stream: () =>
        chunkStream([
          {
            error: { category: "api", message: "provider failed" },
            stopReason: "error",
            type: "finish",
          },
        ]),
    });
  };
}

function providerThrows(error: Error): Extension {
  return (api) => {
    api.provideProvider({
      stream: () => throwingStream(error),
    });
  };
}

function providerStreamCreationThrows(): Extension {
  return (api) => {
    api.provideProvider({
      stream: () => {
        throw new Error("stream setup failed");
      },
    });
  };
}

function capturingProvider(seen: ToolDefinition[][]): Extension {
  return (api) => {
    api.provideProvider({
      stream: (request: ProviderRequest) => {
        seen.push([...request.tools]);
        return chunkStream([
          { text: "schemas", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
}

function providerEndsWithoutFinish(): Extension {
  return (api) => {
    api.provideProvider({
      stream: () =>
        chunkStream([{ text: "done by iterator", type: "text_delta" }]),
    });
  };
}

function abortableProvider(): Extension {
  return (api) => {
    api.provideProvider({
      stream: async function* (request: ProviderRequest) {
        yield { text: "partial", type: "text_delta" };
        await waitForAbort(request.signal);
        yield { stopReason: "aborted", type: "finish" };
      },
    });
  };
}

function abortableToolProvider(): Extension {
  let calls = 0;
  return (api) => {
    api.provideProvider({
      stream: (request: ProviderRequest) => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "call_1", input: {}, name: "wait-for-abort" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          {
            stopReason: request.signal.aborted ? "aborted" : "completed",
            type: "finish",
          },
        ]);
      },
    });
  };
}

function abortableTool(): Extension {
  return (api) => {
    api.registerTool({
      description: "Waits until the session is aborted.",
      execute: async (_input, context) => {
        await waitForAbort(context.signal);
        return { text: "tool aborted", type: "text" };
      },
      name: "wait-for-abort",
      parameters: { type: "object" },
    });
  };
}

function loopingToolProvider(): Extension {
  let calls = 0;
  return (api) => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        return chunkStream([
          {
            toolCall: { id: `call_${calls}`, input: {}, name: "noop" },
            type: "tool_call",
          },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
}

function promptSizedProvider(): Extension {
  return (api) => {
    api.provideProvider({
      stream: (request: ProviderRequest) =>
        chunkStream(sizedChunks(promptContent(request))),
    });
  };
}

function sizedChunks(prompt: string): readonly ProviderChunk[] {
  const count = prompt === "flood" ? 300 : 1;
  const chunks: ProviderChunk[] = [];
  for (let index = 0; index < count; index += 1) {
    chunks.push({ text: `delta ${index}`, type: "text_delta" });
  }
  chunks.push({ stopReason: "completed", type: "finish" });
  return chunks;
}

function promptContent(request: ProviderRequest): string {
  const message = request.messages.at(-1);
  if (message?.role === "user") {
    return message.content;
  }
  return "";
}

function noopTool(): Extension {
  return (api) => {
    api.registerTool({
      description: "Returns a no-op result.",
      execute: () => ({ text: "ok", type: "text" }),
      name: "noop",
      parameters: { type: "object" },
    });
  };
}

function doubleTool(): Extension {
  return (api) => {
    api.registerTool({
      description: "Doubles a numeric value.",
      execute: async (input, context) => {
        await context.update({ text: "halfway", type: "text" });
        return { text: String(readValue(input) * 2), type: "text" };
      },
      name: "double",
      parameters: { type: "object" },
    });
  };
}

function standardTools(): Extension {
  return (api) => {
    api.registerTool({
      description: "Triples a numeric value.",
      execute: (input) => ({
        text: String(readValue(input) * 3),
        type: "text",
      }),
      name: "triple",
      parameters: standardValueSchema,
    });
    api.registerTool({
      description: "Has a validator that throws.",
      execute: () => ({ text: "unreachable", type: "text" }),
      name: "schema-boom",
      parameters: throwingStandardSchema,
    });
  };
}

const standardValueSchema = {
  "~standard": {
    validate: (input: unknown) => {
      if (hasNumericValue(input)) {
        return { value: input };
      }
      if (hasFallbackFlag(input)) {
        return { issues: [{}] };
      }
      return { issues: [{ message: "value is required" }] };
    },
  },
};

const throwingStandardSchema = {
  "~standard": {
    validate: () => {
      throw new Error("schema exploded");
    },
  },
};

function failingTool(): Extension {
  return (api) => {
    api.registerTool({
      description: "Throws for test coverage.",
      execute: () => {
        throw new Error("tool failed");
      },
      name: "boom",
      parameters: { type: "object" },
    });
  };
}

function readValue(input: unknown): number {
  if (hasNumericValue(input)) {
    return input.value;
  }
  return 0;
}

function hasNumericValue(input: unknown): input is { readonly value: number } {
  return (
    typeof input === "object" &&
    input !== null &&
    "value" in input &&
    typeof input.value === "number"
  );
}

function hasFallbackFlag(input: unknown): input is { readonly fallback: true } {
  return (
    typeof input === "object" &&
    input !== null &&
    "fallback" in input &&
    input.fallback === true
  );
}

async function waitForAbort(signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return;
  }
  await new Promise<void>((resolve) => {
    signal.addEventListener(
      "abort",
      () => {
        resolve();
      },
      { once: true },
    );
  });
}
