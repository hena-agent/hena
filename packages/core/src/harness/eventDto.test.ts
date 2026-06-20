import type * as PiAgent from "@earendil-works/pi-agent-core";
import { assert, it } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";

import { toHarnessEventEnvelope } from "./eventSchema";
import { makeHarnessEventBridge } from "./events";

it("wraps raw harness events in a versioned envelope", () => {
  const event = { type: "agent_start" } satisfies PiAgent.AgentHarnessEvent;
  const envelope = toHarnessEventEnvelope(event);

  assert.strictEqual(envelope.version, 1);
  assert.deepStrictEqual(envelope.event, event);
});

it.effect("streams versioned raw harness event envelopes", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const bridge = yield* makeHarnessEventBridge();
      const event = { type: "agent_start" } satisfies PiAgent.AgentHarnessEvent;
      const fiber = yield* bridge.stream.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );

      yield* bridge.publish(event);

      assert.deepStrictEqual(yield* Fiber.join(fiber), [{ version: 1, event }]);
    }),
  ),
);
