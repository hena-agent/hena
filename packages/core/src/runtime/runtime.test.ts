import { assert, it } from "@effect/vitest";
import { Effect, Exit, Fiber, Scope, Stream } from "effect";

import { scriptedModel } from "../test-support/model";
import { makeRuntime } from "./runtime";

it.effect("correlates ask requests with replies", () =>
  Effect.gen(function* () {
    const runtime = yield* makeRuntime;
    const eventsFiber = yield* runtime.events.stream.pipe(
      Stream.take(2),
      Stream.runCollect,
      Effect.forkChild,
    );
    const requestFiber = yield* runtime.events.stream.pipe(
      Stream.take(1),
      Stream.runCollect,
      Effect.forkChild,
    );
    const answerFiber = yield* runtime.ask
      .ask({ prompt: "continue?" })
      .pipe(Effect.forkChild);
    const request = Array.from(yield* Fiber.join(requestFiber))[0];
    if (request?.type !== "ask.requested") {
      assert.fail("expected an ask request event");
    }
    const requested = yield* runtime.ask.pending;

    assert.strictEqual(requested.length, 1);
    yield* runtime.ask.reply({ answer: "yes", id: request.id });

    assert.strictEqual(yield* Fiber.join(answerFiber), "yes");
    assert.deepStrictEqual(
      Array.from(yield* Fiber.join(eventsFiber)).map((event) => event.type),
      ["ask.requested", "ask.replied"],
    );
  }),
);

it.effect("removes scoped registrations when the scope closes", () =>
  Effect.gen(function* () {
    const runtime = yield* makeRuntime;
    const inside = yield* Effect.scoped(
      Effect.gen(function* () {
        yield* runtime.systemPrompt.contribute({ content: "inside" });
        return yield* runtime.systemPrompt.sections;
      }),
    );

    assert.deepStrictEqual(
      inside.map((section) => section.content),
      ["inside"],
    );
    assert.deepStrictEqual(yield* runtime.systemPrompt.sections, []);
    assert.strictEqual(yield* runtime.systemPrompt.text, "");
  }),
);

it.effect("joins system prompt sections", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const runtime = yield* makeRuntime;
      yield* runtime.systemPrompt.contribute({ content: "a" });
      yield* runtime.systemPrompt.contribute({ content: "b" });
      assert.strictEqual(yield* runtime.systemPrompt.text, "a\n\nb");
    }),
  ),
);

it.effect("ignores replies for unknown ask ids", () =>
  Effect.gen(function* () {
    const runtime = yield* makeRuntime;
    yield* runtime.ask.reply({ answer: "ignored", id: "missing" });
    assert.deepStrictEqual(yield* runtime.ask.pending, []);
  }),
);

it.effect("fails when no model is active", () =>
  Effect.gen(function* () {
    const runtime = yield* makeRuntime;
    const error = yield* runtime.models.active.pipe(Effect.flip);
    assert.strictEqual(error._tag, "ModelNotRegistered");
  }),
);

it.effect("does not remove a newer model when an older scope closes", () =>
  Effect.gen(function* () {
    const runtime = yield* makeRuntime;
    const older = yield* Scope.make();
    const newer = yield* Scope.make();
    const olderModel = yield* scriptedModel([]);
    const newerModel = yield* scriptedModel([]);
    yield* runtime.models
      .register({ id: "older", model: olderModel })
      .pipe(Effect.provideService(Scope.Scope, older));
    yield* runtime.models
      .register({ id: "newer", model: newerModel })
      .pipe(Effect.provideService(Scope.Scope, newer));

    yield* Scope.close(older, Exit.void);
    assert.strictEqual(yield* runtime.models.active, newerModel);
  }),
);
