import * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiNode from "@earendil-works/pi-agent-core/node";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { makeAgentTool } from "./schema";
import { ToolInputError } from "./toolErrors";

interface EchoParams {
  readonly text: string;
  readonly count?: number | undefined;
}

interface EchoDetails {
  readonly decoded: EchoParams;
}

const EchoParameters = Schema.Struct({
  text: Schema.String.annotate({ description: "Text to echo" }),
  count: Schema.optional(Schema.Number).annotate({
    description: "Optional echo count",
  }),
});

const makeSession = async (id: string): Promise<PiAgent.Session> => {
  const repo = new PiAgent.InMemorySessionRepo();
  const session = await repo.create({ id });
  return session;
};

const getApiKeyAndHeaders = async (): Promise<{ readonly apiKey: string }> => {
  await Promise.resolve();
  return { apiKey: "test-key" };
};

it("emits Draft-07 JSON Schema parameters at the AgentTool boundary", () => {
  const tool = makeAgentTool<typeof EchoParameters, EchoDetails>({
    label: "Echo",
    name: "echo_tool",
    description: "Echoes decoded arguments",
    parameters: EchoParameters,
    execute: ({ params }) =>
      Effect.succeed({
        content: [{ type: "text", text: params.text }],
        details: { decoded: params },
      }),
  });
  const parameters = tool.parameters;
  const schema = "$schema" in parameters ? parameters.$schema : undefined;
  const type = "type" in parameters ? parameters.type : undefined;
  const additionalProperties =
    "additionalProperties" in parameters
      ? parameters.additionalProperties
      : undefined;

  assert.strictEqual(schema, "http://json-schema.org/draft-07/schema");
  assert.strictEqual(type, "object");
  assert.strictEqual(additionalProperties, false);
});

it("decodes raw tool arguments before executing tool logic", async () => {
  let executed = false;
  const tool = makeAgentTool<typeof EchoParameters, EchoDetails>({
    label: "Echo",
    name: "echo_tool",
    description: "Echoes decoded arguments",
    parameters: EchoParameters,
    execute: ({ params }) => {
      executed = true;
      return Effect.succeed({
        content: [{ type: "text", text: params.text }],
        details: { decoded: params },
      });
    },
  });

  const rejection = await tool.execute("call-1", { count: 1 }).then(
    () => undefined,
    (error: unknown) => error,
  );

  assert.ok(rejection instanceof ToolInputError);
  assert.strictEqual(executed, false);

  const result = await tool.execute("call-2", { text: "hello" });
  assert.deepStrictEqual(result.details.decoded, { text: "hello" });
});

it("forwards abort signals and tool update callbacks", async () => {
  const controller = new AbortController();
  const partial: PiAgent.AgentToolResult<EchoDetails> = {
    content: [{ type: "text", text: "partial" }],
    details: { decoded: { text: "partial" } },
  };
  const updates: Array<PiAgent.AgentToolResult<EchoDetails>> = [];
  let sawSignal = false;
  const tool = makeAgentTool<typeof EchoParameters, EchoDetails>({
    label: "Echo",
    name: "echo_tool",
    description: "Echoes decoded arguments",
    parameters: EchoParameters,
    execute: ({ params, signal, update }) => {
      sawSignal = signal === controller.signal;
      return update(partial).pipe(
        Effect.as({
          content: [{ type: "text", text: params.text }],
          details: { decoded: params },
        }),
      );
    },
  });

  const result = await tool.execute(
    "call-1",
    { text: "hello" },
    controller.signal,
    (partialResult) => {
      updates.push(partialResult);
    },
  );

  assert.strictEqual(sawSignal, true);
  assert.deepStrictEqual(updates, [partial]);
  assert.deepStrictEqual(result.details.decoded, { text: "hello" });
});

it("adapts Effect tool logic for pi AgentHarness execution", async () => {
  const registration = PiAi.registerFauxProvider();
  registration.setResponses([
    PiAi.fauxAssistantMessage(
      PiAi.fauxToolCall(
        "echo_tool",
        { text: "hello", count: 2 },
        { id: "call-1" },
      ),
      { stopReason: "toolUse", timestamp: 1 },
    ),
    PiAi.fauxAssistantMessage("done", { timestamp: 2 }),
  ]);

  const decodedCalls: Array<EchoParams> = [];
  const tool = makeAgentTool<typeof EchoParameters, EchoDetails>({
    label: "Echo",
    name: "echo_tool",
    description: "Echoes decoded arguments",
    parameters: EchoParameters,
    execute: ({
      params,
    }): Effect.Effect<PiAgent.AgentToolResult<EchoDetails>> => {
      decodedCalls.push(params);
      return Effect.succeed({
        content: [{ type: "text", text: params.text }],
        details: { decoded: params },
      });
    },
  });

  const session = await makeSession("schema-tool-parameters");
  const harness = new PiAgent.AgentHarness({
    env: new PiNode.NodeExecutionEnv({ cwd: process.cwd() }),
    getApiKeyAndHeaders,
    model: registration.getModel(),
    session,
    tools: [tool],
  });

  await harness.prompt("call the echo tool");
  registration.unregister();

  assert.deepStrictEqual(decodedCalls, [{ text: "hello", count: 2 }]);
});
