import * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiNode from "@earendil-works/pi-agent-core/node";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { AgentHarnessFactory } from "./AgentHarnessFactory";

const model = PiAi.getModel("openai", "gpt-4o-mini");

const makeSession = (): Effect.Effect<PiAgent.Session> =>
  Effect.promise(async () =>
    new PiAgent.InMemorySessionRepo().create({ id: "factory-session" }),
  );

const getApiKeyAndHeaders = async (): Promise<{ readonly apiKey: string }> => {
  await Promise.resolve();
  return { apiKey: "test-key" };
};

it.effect("constructs a live pi AgentHarness", () =>
  Effect.gen(function* () {
    const factory = yield* AgentHarnessFactory;
    const session = yield* makeSession();
    const harness = yield* factory.create({
      env: new PiNode.NodeExecutionEnv({ cwd: process.cwd() }),
      getApiKeyAndHeaders,
      model,
      session,
    });

    assert.strictEqual(harness.getModel(), model);
  }).pipe(Effect.provide(AgentHarnessFactory.Live)),
);
