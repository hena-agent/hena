import { assert, it } from "@effect/vitest";
import { Context, Effect, Schema } from "effect";

import { makeServiceAgentTool } from "./serviceAgentTool";

interface EchoServiceShape {
  readonly echo: (text: string) => Effect.Effect<string>;
}

class EchoService extends Context.Service<EchoService, EchoServiceShape>()(
  "test/EchoService",
) {}

const EchoParams = Schema.Struct({ text: Schema.String });

it("runs an AgentTool with supplied Effect services", async () => {
  const context = Context.make(EchoService, {
    echo: (text) => Effect.succeed(text.toUpperCase()),
  });
  const tool = makeServiceAgentTool(context, {
    label: "Echo",
    name: "echo",
    description: "Echoes text",
    parameters: EchoParams,
    execute: ({ params }) =>
      Effect.gen(function* () {
        const service = yield* EchoService;
        const text = yield* service.echo(params.text);
        return { content: [{ type: "text", text }], details: {} };
      }),
  });

  const result = await tool.execute("call-1", { text: "hello" });

  assert.deepStrictEqual(result.content, [{ type: "text", text: "HELLO" }]);
});
