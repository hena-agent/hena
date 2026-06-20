import * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiNode from "@earendil-works/pi-agent-core/node";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";

import { attachHarnessEventBridge } from "./attachEvents";
import { makeHarnessEventBridge } from "./events";

const makeSession = async (id: string): Promise<PiAgent.Session> => {
  const repo = new PiAgent.InMemorySessionRepo();
  const session = await repo.create({ id });
  return session;
};

const getApiKeyAndHeaders = async (): Promise<{ readonly apiKey: string }> => {
  await Promise.resolve();
  return { apiKey: "test-key" };
};

const messageUpdate = (
  text: string,
  timestamp: number,
): PiAgent.AgentHarnessEvent => {
  const message = PiAi.fauxAssistantMessage(text, { timestamp });
  return {
    type: "message_update",
    message,
    assistantMessageEvent: {
      type: "text_delta",
      contentIndex: 0,
      delta: text,
      partial: message,
    },
  };
};

const toolUpdate = (
  toolCallId: string,
  text: string,
): PiAgent.AgentHarnessEvent => ({
  type: "tool_execution_update",
  toolCallId,
  toolName: "echo_tool",
  args: {},
  partialResult: { content: [{ type: "text", text }] },
});

it.effect("coalesces deltas while preserving reliable event order", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const bridge = yield* makeHarnessEventBridge();
      const agentStart: PiAgent.AgentHarnessEvent = { type: "agent_start" };
      const firstDelta = messageUpdate("one", 1);
      const secondDelta = messageUpdate("two", 2);
      const settled: PiAgent.AgentHarnessEvent = {
        type: "settled",
        nextTurnCount: 0,
      };
      const eventsFiber = yield* bridge.stream.pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );

      yield* bridge.publish(agentStart);
      bridge.publishUnsafe(firstDelta);
      bridge.publishUnsafe(secondDelta);
      bridge.publishUnsafe(settled);

      const events = yield* Fiber.join(eventsFiber);

      assert.deepStrictEqual(
        events.map((item) => item.event.type),
        ["agent_start", "message_update", "settled"],
      );
      assert.strictEqual(events[1]?.event, secondDelta);
    }),
  ),
);

it.effect("keeps independent delta streams from evicting each other", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const bridge = yield* makeHarnessEventBridge();
      const firstMessageDelta = messageUpdate("one", 1);
      const secondMessageDelta = messageUpdate("two", 2);
      const firstToolDelta = toolUpdate("call-1", "partial");
      const secondToolDelta = toolUpdate("call-1", "complete");
      const settled: PiAgent.AgentHarnessEvent = {
        type: "settled",
        nextTurnCount: 0,
      };
      const eventsFiber = yield* bridge.stream.pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );

      bridge.publishUnsafe(firstMessageDelta);
      bridge.publishUnsafe(firstToolDelta);
      bridge.publishUnsafe(secondMessageDelta);
      bridge.publishUnsafe(secondToolDelta);
      bridge.publishUnsafe(settled);

      const events = yield* Fiber.join(eventsFiber);

      assert.deepStrictEqual(
        events.map((item) => item.event.type),
        ["message_update", "tool_execution_update", "settled"],
      );
      assert.strictEqual(events[0]?.event, secondMessageDelta);
      assert.strictEqual(events[1]?.event, secondToolDelta);
    }),
  ),
);

it.effect("does not move deltas across reliable event barriers", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const bridge = yield* makeHarnessEventBridge();
      const firstDelta = messageUpdate("one", 1);
      const secondDelta = messageUpdate("two", 2);
      const settled: PiAgent.AgentHarnessEvent = {
        type: "settled",
        nextTurnCount: 0,
      };
      const eventsFiber = yield* bridge.stream.pipe(
        Stream.take(3),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );

      bridge.publishUnsafe(firstDelta);
      bridge.publishUnsafe(settled);
      bridge.publishUnsafe(secondDelta);

      const events = yield* Fiber.join(eventsFiber);

      assert.deepStrictEqual(
        events.map((item) => item.event),
        [firstDelta, settled, secondDelta],
      );
    }),
  ),
);

it.effect(
  "bridges harness subscriptions into an Effect stream without blocking settlement",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const registration = PiAi.registerFauxProvider();
        registration.setResponses([
          PiAi.fauxAssistantMessage("ok", { timestamp: 1 }),
        ]);

        const session = yield* Effect.promise(async () => {
          const created = await makeSession("events-bridge");
          return created;
        });
        const harness = new PiAgent.AgentHarness({
          env: new PiNode.NodeExecutionEnv({ cwd: process.cwd() }),
          getApiKeyAndHeaders,
          model: registration.getModel(),
          session,
        });

        const bridge = yield* makeHarnessEventBridge();
        yield* attachHarnessEventBridge(harness, bridge);
        const eventsFiber = yield* bridge.stream.pipe(
          Stream.takeUntil((item) => item.event.type === "settled"),
          Stream.runCollect,
          Effect.forkDetach({ startImmediately: true }),
        );

        yield* Effect.promise(async () => {
          await harness.prompt("hello");
        });
        const events = yield* Fiber.join(eventsFiber);
        registration.unregister();

        assert.ok(events.some((item) => item.event.type === "agent_start"));
        assert.ok(events.some((item) => item.event.type === "message_update"));
        assert.strictEqual(events.at(-1)?.event.type, "settled");
      }),
    ),
);
