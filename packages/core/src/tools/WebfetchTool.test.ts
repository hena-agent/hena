import { assert, it } from "@effect/vitest";
import { Context, Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { ToolHttpError } from "./toolErrors";
import { makeWebfetchAgentTool, WebfetchTool } from "./WebfetchTool";

const makeClient = (body: string, status = 200) =>
  Layer.succeed(HttpClient.HttpClient)(
    HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response(body, { status })),
      ),
    ),
  );

const makeHangingClient = (capture?: (signal: AbortSignal) => void) =>
  Layer.succeed(HttpClient.HttpClient)(
    HttpClient.make((_request, _url, signal) =>
      Effect.sync(() => capture?.(signal)).pipe(Effect.andThen(Effect.never)),
    ),
  );

it.effect("fetches URL content as text", () =>
  Effect.gen(function* () {
    const tool = yield* WebfetchTool;
    const result = yield* tool.execute({
      url: "https://example.test/doc",
    });

    assert.deepStrictEqual(result.content, [{ type: "text", text: "hello" }]);
    assert.deepStrictEqual(result.details, {
      url: "https://example.test/doc",
      status: 200,
      bytes: 5,
      truncated: false,
    });
  }).pipe(
    Effect.provide(WebfetchTool.Live),
    Effect.provide(makeClient("hello")),
  ),
);

it.effect("reports response metadata without format conversion", () =>
  Effect.gen(function* () {
    const tool = yield* WebfetchTool;
    const result = yield* tool.execute({ url: "https://example.test/doc" });

    assert.deepStrictEqual(result.details, {
      url: "https://example.test/doc",
      status: 200,
      bytes: 5,
      truncated: false,
    });
  }).pipe(
    Effect.provide(WebfetchTool.Live),
    Effect.provide(makeClient("hello")),
  ),
);

it.effect("truncates oversized responses", () => {
  const body = "x".repeat(1024 * 1024 + 1);
  return Effect.gen(function* () {
    const tool = yield* WebfetchTool;
    const result = yield* tool.execute({ url: "https://example.test/large" });
    const [content] = result.content;
    if (content?.type !== "text") {
      throw new Error("expected text content");
    }

    assert.strictEqual(content.text.length, 1024 * 1024);
    assert.strictEqual(result.details.bytes, 1024 * 1024 + 1);
    assert.strictEqual(result.details.truncated, true);
  }).pipe(Effect.provide(WebfetchTool.Live), Effect.provide(makeClient(body)));
});

it.effect("fails non-success HTTP responses", () =>
  Effect.gen(function* () {
    const tool = yield* WebfetchTool;
    const exit = yield* tool
      .execute({ url: "https://example.test/missing" })
      .pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
  }).pipe(
    Effect.provide(WebfetchTool.Live),
    Effect.provide(makeClient("no", 404)),
  ),
);

it.effect("fails webfetch calls that exceed the timeout", () =>
  Effect.gen(function* () {
    const tool = yield* WebfetchTool;
    const fiber = yield* tool
      .execute({ url: "https://example.test/slow" })
      .pipe(Effect.flip, Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    yield* TestClock.adjust("30 seconds");
    const error = yield* Fiber.join(fiber);

    assert.ok(error instanceof ToolHttpError);
    assert.strictEqual(error.message, "Webfetch timed out.");
  }).pipe(
    Effect.provide(WebfetchTool.Live),
    Effect.provide(makeHangingClient()),
  ),
);

it.effect("propagates tool abort signals to the HTTP transport", () => {
  let requestSignal: AbortSignal | undefined;
  const controller = new AbortController();
  return Effect.gen(function* () {
    const tool = yield* WebfetchTool;
    const fiber = yield* tool
      .execute(
        { url: "https://example.test/slow" },
        {
          toolCallId: "call-webfetch",
          signal: controller.signal,
          update: () => Effect.void,
        },
      )
      .pipe(Effect.forkDetach({ startImmediately: true }));

    yield* Effect.yieldNow;
    assert.strictEqual(requestSignal?.aborted, false);
    controller.abort();
    const exit = yield* Fiber.join(fiber).pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
    assert.strictEqual(requestSignal?.aborted, true);
  }).pipe(
    Effect.provide(WebfetchTool.Live),
    Effect.provide(
      makeHangingClient((signal) => {
        requestSignal = signal;
      }),
    ),
  );
});

it("adapts WebfetchTool to a pi AgentTool", async () => {
  const tool = makeWebfetchAgentTool(
    Context.make(WebfetchTool, {
      execute: () =>
        Effect.succeed({
          content: [{ type: "text", text: "hello" }],
          details: {
            url: "https://example.test/doc",
            status: 200,
            bytes: 5,
            truncated: false,
          },
        }),
    }),
  );

  const result = await tool.execute("call-1", {
    url: "https://example.test/doc",
  });

  assert.deepStrictEqual(result.details.status, 200);
});
