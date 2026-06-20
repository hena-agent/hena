import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  type CustomModelConfig,
  DefaultModelNotFoundError,
  ModelNotFoundError,
  makeModelRegistry,
} from "./registry";

const localModel = {
  provider: "local",
  id: "llama3",
  name: "Local Llama 3",
  baseUrl: "http://localhost:11434/v1",
  contextWindow: 8_192,
  maxTokens: 1_024,
} satisfies CustomModelConfig;

it.effect("filters built-in models and adds custom models", () =>
  Effect.gen(function* () {
    const registry = yield* makeModelRegistry({
      providers: { openai: { models: ["gpt-4o-mini"] } },
      customModels: [localModel],
    });

    const models = yield* registry.getModels();

    assert.deepStrictEqual(
      models.map((model) => `${model.provider}:${model.id}`),
      ["openai:gpt-4o-mini", "local:llama3"],
    );
    assert.strictEqual(models[1]?.api, "openai-completions");
    assert.strictEqual(models[1]?.baseUrl, "http://localhost:11434/v1");
  }),
);

it.effect(
  "returns unfiltered built-ins and provider-scoped custom models",
  () =>
    Effect.gen(function* () {
      const registry = yield* makeModelRegistry({
        customModels: [
          {
            ...localModel,
            id: "full",
            api: "openai-responses",
            cost: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 },
            input: ["text", "image"],
            reasoning: true,
            thinkingLevelMap: { xhigh: "max" },
          },
          {
            provider: "minimal",
            id: "tiny",
            baseUrl: "http://localhost:1234/v1",
            contextWindow: 4_096,
            maxTokens: 512,
          },
        ],
      });

      const openai = yield* registry.getModels("openai");
      const [custom] = yield* registry.getModels("local");
      const [minimal] = yield* registry.getModels("minimal");

      assert.ok(openai.some((model) => model.id === "gpt-4o-mini"));
      assert.ok(custom !== undefined);
      assert.strictEqual(custom.api, "openai-responses");
      assert.strictEqual("headers" in custom, false);
      assert.strictEqual(minimal?.name, "tiny");
      assert.strictEqual(minimal?.contextWindow, 4_096);
      assert.strictEqual(minimal?.maxTokens, 512);
    }),
);

it.effect("constructs with default config", () =>
  Effect.gen(function* () {
    const registry = yield* makeModelRegistry();
    const openai = yield* registry.getModels("openai");

    assert.ok(openai.length > 0);
  }),
);

it.effect("snapshots model lists", () =>
  Effect.gen(function* () {
    const registry = yield* makeModelRegistry({
      providers: { openai: { models: ["gpt-4o-mini"] } },
    });
    const models = yield* registry.getModels();
    Reflect.set(models, "length", 0);

    const model = yield* registry.getDefaultModel();

    assert.strictEqual(model.id, "gpt-4o-mini");
  }),
);

it.effect(
  "lets custom models explicitly override built-in catalog entries",
  () =>
    Effect.gen(function* () {
      const registry = yield* makeModelRegistry({
        providers: { openai: { models: ["gpt-4o-mini"] } },
        customModels: [
          {
            provider: "openai",
            id: "gpt-4o-mini",
            name: "Custom mini",
            baseUrl: "http://localhost:1234/v1",
            contextWindow: 16,
            maxTokens: 8,
          },
        ],
      });
      const [listed] = yield* registry.getModels("openai");
      const resolved = yield* registry.getModel({
        provider: "openai",
        modelId: "gpt-4o-mini",
      });

      assert.strictEqual(listed?.name, "Custom mini");
      assert.strictEqual(resolved.name, "Custom mini");
    }),
);

it.effect("resolves models and reports filtered misses", () =>
  Effect.gen(function* () {
    const registry = yield* makeModelRegistry({
      providers: { openai: { models: ["gpt-4o-mini"] } },
    });

    const model = yield* registry.getModel({
      provider: "openai",
      modelId: "gpt-4o-mini",
    });
    const error = yield* registry
      .getModel({ provider: "openai", modelId: "gpt-4o" })
      .pipe(Effect.flip);

    assert.strictEqual(model.provider, "openai");
    assert.ok(error instanceof ModelNotFoundError);
    assert.strictEqual(error.provider, "openai");
    assert.strictEqual(error.modelId, "gpt-4o");
  }),
);

it.effect("resolves global and workspace default models", () =>
  Effect.gen(function* () {
    const registry = yield* makeModelRegistry({
      providers: { openai: { models: ["gpt-4o-mini"] } },
      customModels: [localModel],
      default: { provider: "openai", modelId: "gpt-4o-mini" },
      workspaceDefaults: {
        "workspace-1": { provider: "local", modelId: "llama3" },
      },
    });

    const globalDefault = yield* registry.getDefaultModel();
    const workspaceDefault = yield* registry.getDefaultModel("workspace-1");
    const workspaceFallback = yield* registry.getDefaultModel("workspace-2");

    assert.strictEqual(globalDefault.provider, "openai");
    assert.strictEqual(workspaceDefault.provider, "local");
    assert.strictEqual(workspaceFallback.provider, "openai");
  }),
);

it.effect(
  "falls back to the first available model when no default is set",
  () =>
    Effect.gen(function* () {
      const registry = yield* makeModelRegistry({
        providers: { openai: { models: ["gpt-4o-mini"] } },
      });
      const model = yield* registry.getDefaultModel();

      assert.strictEqual(model.id, "gpt-4o-mini");
    }),
);

it.effect("fails when no default model is available", () =>
  Effect.gen(function* () {
    const registry = yield* makeModelRegistry({
      providers: { openai: { models: ["missing-model"] } },
    });
    const error = yield* registry.getDefaultModel().pipe(Effect.flip);

    assert.ok(error instanceof DefaultModelNotFoundError);
  }),
);
