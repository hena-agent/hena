import { ManagedRuntime } from "effect";
import { afterEach, expect, test } from "vitest";
import { raceAbort } from "./abort-signal";
import type { ToolOutput } from "./common";
import { errorFromUnknown } from "./common";
import { corePackageName } from "./core";
import { dispatchToolCalls } from "./dispatch";
import {
  type EventSessions,
  eventSessionIterable,
  publishEventToSession,
  registerEventSession,
  shutdownEventSessions,
  unregisterEventSession,
} from "./event-log";
import type { Extension, ExtensionAPI } from "./extension";
import type { ProviderChunk } from "./provider";
import { createRuntime } from "./runtime";
import { makeCoreLayer } from "./services";
import { makeSessionState } from "./state";
import {
  abortableProvider,
  abortErrorProvider,
  uncooperativeProvider,
} from "./test-support/abort-providers";
import { abortThrowingTool } from "./test-support/abort-tools";
import {
  capturingProvider,
  multiTextProvider,
  providerEndsWithoutFinish,
  providerError,
  providerStreamCreationThrows,
  providerThrows,
  providerWithFailingCleanup,
  providerWithFinally,
  textProvider,
} from "./test-support/basic-providers";
import { promptSizedProvider } from "./test-support/prompt-providers";
import {
  assistantParts,
  collectUntilEnd,
  disposeRuntimes,
  eventTypes,
  lastEvent,
  makeRuntime,
  messageDeltas,
  mockEvent,
  waitForEvent,
  withTimeout,
} from "./test-support/runtime";
import { chunkStream } from "./test-support/streams";
import {
  abortableToolProvider,
  abortThrowingToolProvider,
  loopingToolProvider,
  toolProvider,
  unknownToolProvider,
} from "./test-support/tool-providers";
import {
  abortableTool,
  doubleTool,
  emptyToolSchema,
  failingTool,
  noopTool,
  standardTools,
  standardValueSchema,
  valueToolSchema,
} from "./test-support/tools";
import {
  failingToolProvider,
  validationProvider,
} from "./test-support/validation-providers";
import type { ToolDefinition } from "./tools";

afterEach(async () => {
  await disposeRuntimes();
});

test("exposes the core package name", () => {
  expect(corePackageName).toBe("@hena-dev/core");
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

test("emits tool updates before tool completion", async () => {
  let calls = 0;
  let resolveTool: (() => void) | undefined;
  const toolDone = new Promise<void>((resolve) => {
    resolveTool = resolve;
  });
  const provider: Extension = (api) => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "call_1", input: {}, name: "slow" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "finished", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
  const slowTool: Extension = (api) => {
    api.registerTool({
      description: "Emits progress before finishing.",
      execute: async (_input, context) => {
        await context.update({ text: "working", type: "text" });
        await toolDone;
        return { text: "done", type: "text" };
      },
      name: "slow",
      parameters: { type: "object" },
    });
  };
  const runtime = await makeRuntime([provider, slowTool]);
  const session = runtime.createSession();
  const updatePromise = withTimeout(
    waitForEvent(session.events, "tool_update"),
    1_000,
  );
  const promptPromise = session.prompt("use slow tool");

  await expect(updatePromise).resolves.toMatchObject({
    partial: { text: "working", type: "text" },
    toolCallId: "call_1",
    type: "tool_update",
  });
  resolveTool?.();
  await promptPromise;
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

test("does not block emits on async observers", async () => {
  const hangingObserver: Extension = (api) => {
    api.on("message_delta", async () => {
      await new Promise<never>(() => undefined);
    });
  };
  const runtime = await makeRuntime([
    textProvider("observer should not block"),
    hangingObserver,
  ]);
  const session = runtime.createSession();

  await expect(
    withTimeout(session.prompt("hello"), 1_000),
  ).resolves.toBeUndefined();
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

test("disposing an uncooperative active session does not hang", async () => {
  const runtime = await makeRuntime([uncooperativeProvider()]);
  const session = runtime.createSession();
  const started = waitForEvent(session.events, "message_delta");
  const running = session.prompt("dispose uncooperative");
  running.catch(() => undefined);

  await started;

  await expect(withTimeout(session.dispose(), 1_000)).resolves.toBeUndefined();
});

test("aborts an uncooperative provider read", async () => {
  const runtime = await makeRuntime([uncooperativeProvider()]);
  const session = runtime.createSession();
  const started = waitForEvent(session.events, "message_delta");
  const eventsPromise = collectUntilEnd(session.events);
  const running = session.prompt("abort uncooperative");

  await started;
  session.abort();
  await withTimeout(running, 1_000);

  expect(lastEvent(await eventsPromise)).toMatchObject({
    reason: "aborted",
    type: "agent_end",
  });
});

test("ignores provider cleanup failures after aborting a read", async () => {
  const runtime = await makeRuntime([uncooperativeCleanupProvider()]);
  const session = runtime.createSession();
  const started = waitForEvent(session.events, "message_delta");
  const eventsPromise = collectUntilEnd(session.events);
  const running = session.prompt("abort cleanup failure");

  await started;
  session.abort();
  await withTimeout(running, 1_000);
  await Promise.resolve();

  expect(lastEvent(await eventsPromise)).toMatchObject({
    reason: "aborted",
    type: "agent_end",
  });
});

test("preserves explicit abort reasons when racing aborts", async () => {
  const controller = new AbortController();
  const cause = new Error("explicit abort");
  controller.abort(cause);

  await expect(
    raceAbort(Promise.resolve("unreachable"), controller.signal),
  ).rejects.toBe(cause);
});

test("resolves raced operations while the signal stays active", async () => {
  const controller = new AbortController();

  await expect(
    raceAbort(Promise.resolve("ok"), controller.signal),
  ).resolves.toBe("ok");
});

test("normalizes non-error abort reasons when racing aborts", async () => {
  const stringAbort = new AbortController();
  stringAbort.abort("string abort");
  await expect(
    raceAbort(Promise.resolve("unreachable"), stringAbort.signal),
  ).rejects.toMatchObject({ message: "string abort", name: "AbortError" });

  const fallbackAbort = new AbortController();
  fallbackAbort.abort(123);
  await expect(
    raceAbort(Promise.resolve("unreachable"), fallbackAbort.signal),
  ).rejects.toMatchObject({ message: "Aborted", name: "AbortError" });
});

test("rejects a pending operation when the signal aborts", async () => {
  const controller = new AbortController();
  const pending = raceAbort(
    new Promise<never>(() => undefined),
    controller.signal,
  );

  controller.abort("future abort");

  await expect(pending).rejects.toMatchObject({
    message: "future abort",
    name: "AbortError",
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
    valueToolSchema,
    emptyToolSchema,
  ]);
  expect(JSON.stringify(seen)).not.toContain("~standard");
});

test("rejects standard-schema tools without provider schemas", async () => {
  await expect(
    makeRuntime([
      textProvider("unused"),
      (api) => {
        Reflect.apply(api.registerTool, api, [
          {
            description: "Invalid standard-schema tool.",
            execute: () => ({ text: "unused", type: "text" }),
            name: "invalid-standard",
            parameters: standardValueSchema,
          },
        ]);
      },
    ]),
  ).rejects.toThrow(
    "Standard-schema tool requires provider schema: invalid-standard",
  );
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

test("disposing an uncooperative active tool does not hang", async () => {
  const runtime = await makeRuntime([
    uncooperativeToolProvider(),
    uncooperativeTool(),
  ]);
  const session = runtime.createSession();
  const toolStarted = waitForEvent(session.events, "tool_start");
  const running = session.prompt("dispose uncooperative tool");
  running.catch(() => undefined);

  await toolStarted;

  await expect(withTimeout(session.dispose(), 1_000)).resolves.toBeUndefined();
  await expect(
    withTimeout(
      running.then(
        () => undefined,
        () => undefined,
      ),
      1_000,
    ),
  ).resolves.toBeUndefined();
});

test("does not dispatch tools after the run is already aborted", async () => {
  let executed = false;
  const runtime = ManagedRuntime.make(
    makeCoreLayer(
      {
        stream: () =>
          chunkStream([{ stopReason: "completed", type: "finish" }]),
      },
      [
        {
          description: "Should not execute.",
          execute: () => {
            executed = true;
            return { text: "unexpected", type: "text" };
          },
          name: "blocked",
          parameters: { type: "object" },
        },
      ],
      [],
    ),
  );
  try {
    const state = runtime.runSync(makeSessionState("session_1"));
    const controller = new AbortController();
    controller.abort();

    const result = await runtime.runPromise(
      dispatchToolCalls(
        state,
        [{ id: "call_1", input: {}, name: "blocked" }],
        controller.signal,
      ),
    );

    expect(result).toEqual({ type: "aborted" });
    expect(executed).toBe(false);
  } finally {
    await runtime.dispose();
  }
});

test("ignores tool updates after tool execution closes", async () => {
  let lateUpdate: ((partial: ToolOutput) => Promise<void>) | undefined;
  const runtime = await makeRuntime([
    lateUpdateProvider(),
    (api) => {
      api.registerTool({
        description: "Stores the update callback.",
        execute: (_input, context) => {
          lateUpdate = context.update;
          return { text: "done", type: "text" };
        },
        name: "late-update",
        parameters: { type: "object" },
      });
    },
  ]);
  const session = runtime.createSession();

  await session.prompt("late update");
  if (lateUpdate === undefined) {
    throw new Error("Tool update callback was not captured");
  }
  await lateUpdate({ text: "too late", type: "text" });

  const iterator = session.events[Symbol.asyncIterator]();
  try {
    let event = await iterator.next();
    while (event.done !== true && event.value.type !== "agent_end") {
      event = await iterator.next();
    }
    await expect(withTimeout(iterator.next(), 100)).rejects.toThrow(
      "Timed out waiting for events",
    );
  } finally {
    await iterator.return?.();
  }
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

test("normalizes provider stream creation AbortError throws as aborts", async () => {
  const provider: Extension = (api) => {
    api.provideProvider({
      stream: () => {
        const error = new Error("The operation was aborted");
        error.name = "AbortError";
        throw error;
      },
    });
  };
  const runtime = await makeRuntime([provider]);
  const session = runtime.createSession();

  await session.prompt("fail before stream");

  expect(session.transcript()[1]).toMatchObject({
    stopReason: "aborted",
  });
});

test("normalizes provider AbortError throws as aborts", async () => {
  const runtime = await makeRuntime([abortErrorProvider()]);
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
  expect(session.transcript()[1]).toMatchObject({
    stopReason: "aborted",
  });
});

test("classifies thrown values", () => {
  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  expect(errorFromUnknown(abortError)).toEqual({
    category: "aborted",
    message: "aborted",
  });
  expect(errorFromUnknown("string failure")).toEqual({
    category: "unknown",
    message: "string failure",
  });
  expect(errorFromUnknown({})).toEqual({
    category: "unknown",
    message: "Unknown error",
  });
});

test("treats a provider stream ending without finish as an error", async () => {
  const runtime = await makeRuntime([providerEndsWithoutFinish()]);
  const session = runtime.createSession();

  await session.prompt("no finish");

  expect(session.transcript()[1]).toMatchObject({
    error: { message: "Provider stream ended without a finish chunk" },
    parts: [{ text: "done by iterator", type: "text" }],
    stopReason: "error",
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

test("propagates tool AbortError as an agent abort", async () => {
  const runtime = await makeRuntime([
    abortThrowingToolProvider(),
    abortThrowingTool(),
  ]);
  const session = runtime.createSession();
  const toolStarted = waitForEvent(session.events, "tool_start");
  const eventsPromise = collectUntilEnd(session.events);
  const promptPromise = session.prompt("stop throwing tool");

  await toolStarted;
  session.abort();
  await promptPromise;

  const events = await eventsPromise;
  expect(lastEvent(events)).toMatchObject({
    reason: "aborted",
    type: "agent_end",
  });
  expect(session.transcript()).toHaveLength(3);
  expect(session.transcript()[2]).toMatchObject({
    content: { text: "tool aborted", type: "text" },
    isError: true,
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
  registerEventSession(sessions, "events");
  const events = eventSessionIterable(sessions, "events");
  const iterator = events[Symbol.asyncIterator]();
  const pending = iterator.next();

  expect(await iterator.return?.()).toEqual({ done: true, value: undefined });
  expect(await withTimeout(pending, 1_000)).toEqual({
    done: true,
    value: undefined,
  });

  const closing = events[Symbol.asyncIterator]();
  const closingPending = closing.next();
  unregisterEventSession(sessions, "events");
  expect(await withTimeout(closingPending, 1_000)).toEqual({
    done: true,
    value: undefined,
  });
});

test("event iterators handle missing sessions and shutdown", async () => {
  const sessions: EventSessions = new Map();
  const missing = eventSessionIterable(sessions, "missing");
  const missingIterator = missing[Symbol.asyncIterator]();

  expect(await missingIterator.next()).toEqual({
    done: true,
    value: undefined,
  });
  expect(await missingIterator.next()).toEqual({
    done: true,
    value: undefined,
  });
  publishEventToSession(sessions, mockEvent("missing"));
  unregisterEventSession(sessions, "missing");
  registerEventSession(sessions, "shutdown");
  publishEventToSession(sessions, mockEvent("shutdown"));
  shutdownEventSessions(sessions);
  expect(sessions.size).toBe(0);
});

function lateUpdateProvider(): Extension {
  let calls = 0;
  return (api) => {
    api.provideProvider({
      stream: () => {
        calls += 1;
        if (calls === 1) {
          return chunkStream([
            {
              toolCall: { id: "late_1", input: {}, name: "late-update" },
              type: "tool_call",
            },
            { stopReason: "completed", type: "finish" },
          ]);
        }
        return chunkStream([
          { text: "late update complete", type: "text_delta" },
          { stopReason: "completed", type: "finish" },
        ]);
      },
    });
  };
}

function uncooperativeToolProvider(): Extension {
  return (api) => {
    api.provideProvider({
      stream: () =>
        chunkStream([
          {
            toolCall: { id: "never_1", input: {}, name: "never" },
            type: "tool_call",
          },
          { stopReason: "completed", type: "finish" },
        ]),
    });
  };
}

function uncooperativeTool(): Extension {
  return (api) => {
    api.registerTool({
      description: "Never resolves and ignores abort.",
      execute: async (): Promise<ToolOutput> => {
        await new Promise<never>(() => undefined);
        return { text: "unreachable", type: "text" };
      },
      name: "never",
      parameters: { type: "object" },
    });
  };
}

function uncooperativeCleanupProvider(): Extension {
  return (api) => {
    api.provideProvider({
      stream: () => ({
        [Symbol.asyncIterator]: () => {
          let started = false;
          return {
            next: async (): Promise<IteratorResult<ProviderChunk>> => {
              if (!started) {
                started = true;
                return {
                  done: false,
                  value: { text: "partial", type: "text_delta" },
                };
              }
              await new Promise<never>(() => undefined);
              return { done: true, value: undefined };
            },
            return: async (): Promise<IteratorResult<ProviderChunk>> => {
              await Promise.resolve();
              throw new Error("cleanup failed");
            },
          };
        },
      }),
    });
  };
}
