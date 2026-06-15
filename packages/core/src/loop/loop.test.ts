import { assert, it } from "@effect/vitest";
import { Effect, Ref, Schema } from "effect";
import { Response, Tool } from "effect/unstable/ai";
import { makeRuntime } from "../runtime/runtime";
import { finish, scriptedModel, text } from "../test-support/model";

it.effect("runs tool calls concurrently and continues with results", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const runtime = yield* makeRuntime;
      const calls = yield* Ref.make<ReadonlyArray<string>>([]);
      const ping = Tool.make("ping", {
        parameters: Schema.Struct({ value: Schema.String }),
      });
      const pong = Tool.make("pong", {
        parameters: Schema.Struct({ value: Schema.String }),
      });
      const model = yield* scriptedModel([
        [
          Response.makePart("tool-call", {
            id: "call_1",
            name: "ping",
            params: { value: "a" },
            providerExecuted: false,
          }),
          Response.makePart("tool-call", {
            id: "call_2",
            name: "pong",
            params: { value: "b" },
            providerExecuted: false,
          }),
          finish("tool-calls"),
        ],
        [...text("text_1", "done"), finish("stop")],
      ]);

      yield* runtime.models.register({ id: "scripted", model });
      yield* runtime.permissions.register(() =>
        Effect.succeed({ status: "allow" }),
      );
      yield* runtime.tools.register("ping", ping, (params) =>
        Schema.decodeUnknownEffect(Schema.Struct({ value: Schema.String }))(
          params,
        ).pipe(
          Effect.flatMap(({ value }) =>
            Ref.update(calls, (items) => [...items, `ping:${value}`]),
          ),
          Effect.as("pinged"),
        ),
      );
      yield* runtime.tools.register("pong", pong, (params) =>
        Schema.decodeUnknownEffect(Schema.Struct({ value: Schema.String }))(
          params,
        ).pipe(
          Effect.flatMap(({ value }) =>
            Ref.update(calls, (items) => [...items, `pong:${value}`]),
          ),
          Effect.as("ponged"),
        ),
      );

      yield* runtime.run("start");
      const snapshot = yield* runtime.snapshot;
      const callList = yield* Ref.get(calls);

      assert.deepStrictEqual([...callList].sort(), ["ping:a", "pong:b"]);
      assert.strictEqual(snapshot.text, "done");
    }),
  ),
);

it.effect("returns denied permissions as failed tool results", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const runtime = yield* makeRuntime;
      const calls = yield* Ref.make(0);
      const edit = Tool.make("edit");
      const model = yield* scriptedModel([
        [
          Response.makePart("tool-call", {
            id: "call_1",
            name: "edit",
            params: {},
            providerExecuted: false,
          }),
          finish("tool-calls"),
        ],
        [...text("text_1", "corrected"), finish("stop")],
      ]);

      yield* runtime.models.register({ id: "scripted", model });
      yield* runtime.permissions.register(() =>
        Effect.succeed({ reason: "no edits", status: "deny" }),
      );
      yield* runtime.tools.register("edit", edit, () =>
        Ref.update(calls, (value) => value + 1).pipe(Effect.as("edited")),
      );

      yield* runtime.run("start");
      const snapshot = yield* runtime.snapshot;

      assert.strictEqual(yield* Ref.get(calls), 0);
      assert.strictEqual(snapshot.text, "corrected");
      assert.strictEqual(snapshot.toolResults[0]?.isFailure, true);
      assert.strictEqual(snapshot.toolResults[0]?.result, "no edits");
    }),
  ),
);

it.effect("returns handler failures as failed tool results", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const runtime = yield* makeRuntime;
      const fail = Tool.make("fail");
      const model = yield* scriptedModel([
        [
          Response.makePart("tool-call", {
            id: "call_1",
            name: "fail",
            params: {},
            providerExecuted: false,
          }),
          finish("tool-calls"),
        ],
        [...text("text_1", "corrected"), finish("stop")],
      ]);

      yield* runtime.models.register({ id: "scripted", model });
      yield* runtime.tools.register("fail", fail, () => Effect.fail("boom"));
      yield* runtime.run("start");
      const snapshot = yield* runtime.snapshot;

      assert.strictEqual(snapshot.toolResults[0]?.isFailure, true);
      assert.strictEqual(snapshot.toolResults[0]?.result, "boom");
    }),
  ),
);
