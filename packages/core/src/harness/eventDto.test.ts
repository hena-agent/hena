import type * as PiAgent from "@earendil-works/pi-agent-core";
import { assert, it } from "@effect/vitest";
import { Effect, Fiber, Schema, Stream } from "effect";

import { HarnessEventDTO } from "./eventSchema";
import { makeHarnessEventBridge } from "./events";

it("encodes harness events as stable versioned DTOs", () => {
  const event = { type: "agent_start" } satisfies PiAgent.AgentHarnessEvent;
  const decoded = Schema.decodeUnknownSync(HarnessEventDTO)({
    version: 1,
    event,
  });

  assert.strictEqual(decoded.version, 1);
  assert.deepStrictEqual(decoded.event, event);
});

it.effect("streams versioned harness event DTOs", () =>
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
