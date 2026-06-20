import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeCredentialResolver } from "./credentials";

const openaiModel = PiAi.getModel("openai", "gpt-4o-mini");

it.effect("uses configured credentials before env credentials", () =>
  Effect.gen(function* () {
    const resolver = makeCredentialResolver({
      env: { OPENAI_API_KEY: "env-key" },
      providers: {
        openai: { apiKey: "config-key", headers: { "x-config": "yes" } },
      },
    });
    const result = yield* resolver.getApiKeyAndHeaders({
      ...openaiModel,
      headers: { "x-model": "yes" },
    });

    assert.deepStrictEqual(result, {
      apiKey: "config-key",
      headers: { "x-model": "yes", "x-config": "yes" },
    });
  }),
);

it.effect("falls back to provider environment variables", () =>
  Effect.gen(function* () {
    const resolver = makeCredentialResolver({
      env: { OPENAI_API_KEY: "env-key" },
    });
    const result = yield* resolver.getApiKeyAndHeaders(openaiModel);

    assert.deepStrictEqual(result, { apiKey: "env-key" });
  }),
);

it.effect("resolves configured env-key indirection", () =>
  Effect.gen(function* () {
    const resolver = makeCredentialResolver({
      env: { LOCAL_API_KEY: "local-key" },
      providers: { local: { envKey: "LOCAL_API_KEY" } },
    });
    const result = yield* resolver.getApiKeyAndHeaders({
      ...openaiModel,
      provider: "local",
    });

    assert.deepStrictEqual(result, { apiKey: "local-key" });
  }),
);

it.effect("returns undefined when no credentials are configured", () =>
  Effect.gen(function* () {
    const resolver = makeCredentialResolver();
    const result = yield* resolver.getApiKeyAndHeaders({
      ...openaiModel,
      provider: "local",
    });

    assert.strictEqual(result, undefined);
  }),
);
