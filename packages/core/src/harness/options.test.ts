import * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiNode from "@earendil-works/pi-agent-core/node";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { makeLocalExecutionEnvProvider } from "../execution/ExecutionEnvProvider";
import { makeCredentialResolver } from "../model/credentials";
import { makeAgentTool } from "../tools/schema";
import { makeAgentHarnessOptions } from "./options";

const model = PiAi.getModel("openai", "gpt-4o-mini");
const EmptyParams = Schema.Struct({});
const skill = {
  name: "review",
  description: "Review changes",
  content: "Review carefully.",
  filePath: "/skills/review/SKILL.md",
} satisfies PiAgent.Skill;

const makeSession = (): Effect.Effect<PiAgent.Session> =>
  Effect.promise(async () => {
    const session = await new PiAgent.InMemorySessionRepo().create({
      id: "ses",
    });
    return session;
  });

it.effect("assembles pi AgentHarnessOptions from core services", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const cwd = process.cwd();
      const session = yield* makeSession();
      const tool = makeAgentTool<typeof EmptyParams, Record<string, never>>({
        label: "Echo",
        name: "echo",
        description: "Echo tool",
        parameters: EmptyParams,
        execute: () => Effect.succeed({ content: [], details: {} }),
      });
      const options = yield* makeAgentHarnessOptions({
        execution: {
          provider: makeLocalExecutionEnvProvider(),
          request: { sessionID: "ses", cwd, roots: [cwd] },
        },
        session,
        model,
        thinkingLevel: "minimal",
        tools: [tool],
        activeToolNames: ["echo"],
        credentials: makeCredentialResolver({
          providers: { openai: { apiKey: "test-key" } },
        }),
        resources: { skills: [skill] },
        streamOptions: { timeoutMs: 1_000 },
        systemPrompt: {
          baseInstructions: "Base prompt.",
          date: "2026-06-19",
          extraInstructions: "Extra prompt.",
          os: "darwin",
          projectInstructions: [
            { path: `${cwd}/AGENTS.md`, content: "Use bun." },
          ],
        },
      });

      assert.strictEqual(options.env.cwd, cwd);
      assert.strictEqual(options.session, session);
      assert.strictEqual(options.model, model);
      assert.strictEqual(options.thinkingLevel, "minimal");
      assert.deepStrictEqual(options.tools, [tool]);
      assert.deepStrictEqual(options.activeToolNames, ["echo"]);
      assert.deepStrictEqual(options.resources, { skills: [skill] });
      assert.deepStrictEqual(options.streamOptions, { timeoutMs: 1_000 });
      const getApiKeyAndHeaders = options.getApiKeyAndHeaders;
      assert.strictEqual(typeof getApiKeyAndHeaders, "function");
      if (getApiKeyAndHeaders !== undefined) {
        assert.deepStrictEqual(
          yield* Effect.promise(async () => {
            const key = await getApiKeyAndHeaders(model);
            return key;
          }),
          { apiKey: "test-key" },
        );
      }
      const systemPrompt = options.systemPrompt;
      assert.strictEqual(typeof systemPrompt, "function");
      if (typeof systemPrompt === "function") {
        const prompt = yield* Effect.promise(async () => {
          const rendered = await systemPrompt({
            env: options.env,
            session,
            model,
            thinkingLevel: "minimal",
            activeTools: [tool],
            resources: { skills: [skill] },
          });
          return rendered;
        });

        assert.ok(prompt.includes("Base prompt."));
        assert.ok(prompt.includes("cwd: "));
        assert.ok(prompt.includes("roots: "));
        assert.ok(prompt.includes("date: 2026-06-19"));
        assert.ok(prompt.includes("active tools: echo"));
        assert.ok(prompt.includes("Use bun."));
        assert.ok(prompt.includes("Extra prompt."));
      }
    }),
  ),
);

it.effect(
  "assembles default harness options when optional config is absent",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const cwd = process.cwd();
        const session = yield* makeSession();
        const options = yield* makeAgentHarnessOptions({
          execution: {
            provider: makeLocalExecutionEnvProvider(),
            request: { sessionID: "ses", cwd, roots: [] },
          },
          session,
          model,
        });

        assert.strictEqual(options.activeToolNames, undefined);
        assert.strictEqual(options.getApiKeyAndHeaders, undefined);
        assert.strictEqual(options.resources, undefined);
        assert.strictEqual(options.streamOptions, undefined);
        assert.strictEqual(options.thinkingLevel, undefined);
        assert.strictEqual(options.tools, undefined);

        const systemPrompt = options.systemPrompt;
        assert.strictEqual(typeof systemPrompt, "function");
        if (typeof systemPrompt === "function") {
          const prompt = yield* Effect.promise(async () => {
            const rendered = await systemPrompt({
              env: options.env,
              session,
              model,
              thinkingLevel: "off",
              activeTools: [],
              resources: {},
            });
            return rendered;
          });

          assert.ok(prompt.includes("os: unknown"));
          assert.ok(prompt.includes("active tools: none"));
        }
      }),
    ),
);

it.effect(
  "cleans up acquired execution environments when the scope closes",
  () =>
    Effect.gen(function* () {
      let cleaned = false;
      const cwd = process.cwd();
      const session = yield* makeSession();

      yield* Effect.scoped(
        makeAgentHarnessOptions({
          execution: {
            provider: {
              create: () =>
                Effect.succeed({
                  cwd,
                  roots: [cwd],
                  env: new PiNode.NodeExecutionEnv({ cwd }),
                  cleanup: Effect.sync(() => {
                    cleaned = true;
                  }),
                }),
            },
            request: { sessionID: "ses", cwd, roots: [cwd] },
          },
          session,
          model,
        }),
      );

      assert.strictEqual(cleaned, true);
    }),
);
