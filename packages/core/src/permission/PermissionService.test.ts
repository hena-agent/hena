import { assert, it } from "@effect/vitest";
import { Effect, Fiber, Stream } from "effect";

import { PermissionService } from "./PermissionService";

it.effect(
  "resolves pending permissions by grant and remembers always grants",
  () =>
    Effect.gen(function* () {
      const service = yield* PermissionService;
      const eventsFiber = yield* service.events.pipe(
        Stream.take(2),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );
      const fiber = yield* service
        .ask({
          sessionID: "session-1",
          permission: "external_directory",
          patterns: ["/outside/*"],
          always: ["/outside/*"],
          metadata: { filepath: "/outside/file.txt", parentDir: "/outside" },
          tool: { callID: "call-1" },
        })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const [pending] = yield* service.list();
      if (pending === undefined) {
        throw new Error("expected a pending permission request");
      }

      assert.strictEqual(pending.id.startsWith("per-"), true);
      assert.strictEqual(pending.tool?.callID, "call-1");

      yield* service.grant({ requestID: pending.id, scope: "always" });
      yield* Fiber.join(fiber);
      const events = yield* Fiber.join(eventsFiber);

      assert.deepStrictEqual(yield* service.list(), []);
      assert.deepStrictEqual(
        events.map((event) => event.type),
        ["permission.asked", "permission.granted"],
      );

      yield* service.ask({
        sessionID: "session-1",
        permission: "external_directory",
        patterns: ["/outside/*"],
        always: ["/outside/*"],
        metadata: {},
      });
      assert.deepStrictEqual(yield* service.list(), []);
    }).pipe(Effect.provide(PermissionService.Live)),
);

it.effect("keeps always grants scoped to a session", () =>
  Effect.gen(function* () {
    const service = yield* PermissionService;
    const firstFiber = yield* service
      .ask({
        sessionID: "session-1",
        permission: "external_directory",
        patterns: ["/outside/*"],
        always: ["/outside/*"],
        metadata: {},
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    const [first] = yield* service.list();
    if (first === undefined) {
      throw new Error("expected a pending permission request");
    }
    yield* service.grant({ requestID: first.id, scope: "always" });
    yield* Fiber.join(firstFiber);

    const secondFiber = yield* service
      .ask({
        sessionID: "session-2",
        permission: "external_directory",
        patterns: ["/outside/*"],
        always: ["/outside/*"],
        metadata: {},
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    const [second] = yield* service.list();
    if (second === undefined) {
      throw new Error("expected session-2 to require its own permission");
    }
    assert.strictEqual(second.sessionID, "session-2");

    yield* service.deny({ requestID: second.id });
    yield* Fiber.join(secondFiber).pipe(Effect.exit);
  }).pipe(Effect.provide(PermissionService.Live)),
);

it.effect("always grants resolve already pending matching requests", () =>
  Effect.gen(function* () {
    const service = yield* PermissionService;
    const firstFiber = yield* service
      .ask({
        sessionID: "session-1",
        permission: "external_directory",
        patterns: ["/outside/*"],
        always: ["/outside/*"],
        metadata: {},
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));
    const secondFiber = yield* service
      .ask({
        sessionID: "session-1",
        permission: "external_directory",
        patterns: ["/outside/*"],
        always: ["/outside/*"],
        metadata: {},
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    const [first] = yield* service.list();
    if (first === undefined) {
      throw new Error("expected a pending permission request");
    }

    yield* service.grant({ requestID: first.id, scope: "always" });
    yield* Fiber.join(firstFiber);
    yield* Fiber.join(secondFiber);

    assert.deepStrictEqual(yield* service.list(), []);
  }).pipe(Effect.provide(PermissionService.Live)),
);

it.effect("uses always patterns as the reuse key", () =>
  Effect.gen(function* () {
    const service = yield* PermissionService;
    const firstFiber = yield* service
      .ask({
        sessionID: "session-1",
        permission: "external_directory",
        patterns: ["/outside/file.txt"],
        always: ["/outside/*"],
        metadata: {},
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    const [first] = yield* service.list();
    if (first === undefined) {
      throw new Error("expected a pending permission request");
    }
    yield* service.grant({ requestID: first.id, scope: "always" });
    yield* Fiber.join(firstFiber);

    yield* service.ask({
      sessionID: "session-1",
      permission: "external_directory",
      patterns: ["/outside/other.txt"],
      always: ["/outside/*"],
      metadata: {},
    });

    assert.deepStrictEqual(yield* service.list(), []);
  }).pipe(Effect.provide(PermissionService.Live)),
);

it.effect("denies pending permissions and reports missing request ids", () =>
  Effect.gen(function* () {
    const service = yield* PermissionService;
    const fiber = yield* service
      .ask({
        sessionID: "session-1",
        permission: "external_directory",
        patterns: ["/outside/*"],
        always: ["/outside/*"],
        metadata: {},
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    const [pending] = yield* service.list();
    if (pending === undefined) {
      throw new Error("expected a pending permission request");
    }

    yield* service.deny({ requestID: pending.id, message: "No" });
    const exit = yield* Fiber.join(fiber).pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");

    const grantError = yield* service
      .grant({ requestID: "per-missing", scope: "once" })
      .pipe(Effect.flip);
    assert.strictEqual(grantError._tag, "PermissionRequestNotFound");

    const denyError = yield* service
      .deny({ requestID: "per-missing" })
      .pipe(Effect.flip);
    assert.strictEqual(denyError._tag, "PermissionRequestNotFound");
  }).pipe(Effect.provide(PermissionService.Live)),
);

it.effect("denies pending permissions when the service scope closes", () =>
  Effect.gen(function* () {
    const exit = yield* Effect.scoped(
      Effect.gen(function* () {
        const service = yield* PermissionService;
        const fiber = yield* service
          .ask({
            sessionID: "session-1",
            permission: "external_directory",
            patterns: ["/outside/*"],
            always: ["/outside/*"],
            metadata: {},
          })
          .pipe(Effect.forkDetach({ startImmediately: true }));

        yield* Effect.yieldNow;
        return fiber;
      }).pipe(Effect.provide(PermissionService.Live)),
    ).pipe(
      Effect.flatMap((fiber) => Fiber.join(fiber)),
      Effect.exit,
    );

    assert.strictEqual(exit._tag, "Failure");
  }),
);

it.effect("snapshots permission request inputs", () =>
  Effect.gen(function* () {
    const service = yield* PermissionService;
    const patterns = ["/outside/*"];
    const always = ["/outside/*"];
    const metadata = { filepath: "/outside/file.txt" };
    const tool = { callID: "call-permission" };
    const fiber = yield* service
      .ask({
        sessionID: "session-1",
        permission: "external_directory",
        patterns,
        always,
        metadata,
        tool,
      })
      .pipe(Effect.forkDetach({ startImmediately: true }));

    patterns.push("/mutated/*");
    always.push("/mutated/*");
    metadata.filepath = "/mutated/file.txt";
    tool.callID = "mutated";
    yield* Effect.yieldNow;
    const [pending] = yield* service.list();
    if (pending === undefined) {
      throw new Error("expected a pending permission request");
    }

    assert.deepStrictEqual(pending.patterns, ["/outside/*"]);
    assert.deepStrictEqual(pending.always, ["/outside/*"]);
    assert.deepStrictEqual(pending.metadata, { filepath: "/outside/file.txt" });
    assert.strictEqual(pending.tool?.callID, "call-permission");

    yield* service.deny({ requestID: pending.id });
    yield* Fiber.join(fiber).pipe(Effect.exit);
  }).pipe(Effect.provide(PermissionService.Live)),
);

it.effect(
  "snapshots exposed pending permission requests and asked events",
  () =>
    Effect.gen(function* () {
      const service = yield* PermissionService;
      const eventsFiber = yield* service.events.pipe(
        Stream.take(1),
        Stream.runCollect,
        Effect.forkDetach({ startImmediately: true }),
      );
      const fiber = yield* service
        .ask({
          sessionID: "session-1",
          permission: "external_directory",
          patterns: ["/outside/*"],
          always: ["/outside/*"],
          metadata: { filepath: "/outside/file.txt" },
          tool: { callID: "call-permission" },
        })
        .pipe(Effect.forkDetach({ startImmediately: true }));

      yield* Effect.yieldNow;
      const events = yield* Fiber.join(eventsFiber);
      const [pending] = yield* service.list();
      if (pending === undefined) {
        throw new Error("expected a pending permission request");
      }
      Object.assign(pending.metadata, { filepath: "/mutated/file.txt" });
      Object.assign(pending.tool ?? {}, { callID: "mutated" });

      const [freshPending] = yield* service.list();
      assert.deepStrictEqual(freshPending?.metadata, {
        filepath: "/outside/file.txt",
      });
      assert.strictEqual(freshPending?.tool?.callID, "call-permission");
      if (events[0]?.type === "permission.asked") {
        assert.deepStrictEqual(events[0].request.metadata, {
          filepath: "/outside/file.txt",
        });
        assert.strictEqual(events[0].request.tool?.callID, "call-permission");
      }

      yield* service.deny({ requestID: pending.id });
      yield* Fiber.join(fiber).pipe(Effect.exit);
    }).pipe(Effect.provide(PermissionService.Live)),
);
