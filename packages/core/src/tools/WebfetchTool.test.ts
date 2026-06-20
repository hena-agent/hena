import { assert, it } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import { makeWebfetchAgentTool, WebfetchTool } from "./WebfetchTool";

const makeClient = (body: string, status = 200) =>
  Layer.succeed(HttpClient.HttpClient)(
    HttpClient.make((request) =>
      Effect.succeed(
        HttpClientResponse.fromWeb(request, new Response(body, { status })),
      ),
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
    });
  }).pipe(
    Effect.provide(WebfetchTool.Live),
    Effect.provide(makeClient("hello")),
  ),
);

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
          },
        }),
    }),
  );

  const result = await tool.execute("call-1", {
    url: "https://example.test/doc",
  });

  assert.deepStrictEqual(result.details.status, 200);
});
