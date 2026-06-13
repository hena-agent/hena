import { afterEach, expect, test } from "vitest";

import { errorFromUnknown } from "./common";
import type { CoreEvent } from "./events";
import type { Extension } from "./extension";
import { corePackageName } from "./index";
import type { ProviderChunk, ProviderRequest } from "./provider";
import { createRuntime, type HenaRuntime } from "./runtime";

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

test("keeps event replay buffers isolated per session", async () => {
  const runtime = await makeRuntime([promptSizedProvider()]);
  const quiet = runtime.createSession();
  const flood = runtime.createSession();

  await quiet.prompt("quiet");
  await flood.prompt("flood");

  const events = await withTimeout(collectUntilEnd(quiet.events), 1_000);
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
  expect(events.every((event) => event.sessionId === quiet.id)).toBe(true);
  expect(lastEvent(events)).toMatchObject({ reason: "completed" });
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
