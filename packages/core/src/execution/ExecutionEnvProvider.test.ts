import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  ExecutionEnvProviderError,
  makeCloudExecutionEnvProvider,
  makeLocalExecutionEnvProvider,
} from "./ExecutionEnvProvider";

it.effect("creates local harness execution environments", () =>
  Effect.gen(function* () {
    const provider = makeLocalExecutionEnvProvider();
    const cwd = process.cwd();
    const environment = yield* provider.create({
      sessionID: "ses-local",
      cwd,
      roots: [cwd, `${cwd}/extra`],
    });

    assert.strictEqual(environment.cwd, cwd);
    assert.deepStrictEqual(environment.roots, [cwd, `${cwd}/extra`]);
    assert.strictEqual(environment.env.cwd, cwd);

    yield* environment.cleanup;

    const custom = yield* provider.create({
      sessionID: "ses-local-custom",
      cwd,
      roots: [],
      shellEnv: { HENA_TEST: "1" },
      shellPath: "/bin/sh",
    });

    assert.deepStrictEqual(custom.roots, [cwd]);
    yield* custom.cleanup;
  }),
);

it.effect("keeps cloud execution environments behind a typed stub", () =>
  Effect.gen(function* () {
    const provider = makeCloudExecutionEnvProvider();
    const error = yield* provider
      .create({ sessionID: "ses-cloud", cwd: "/workspace", roots: [] })
      .pipe(Effect.flip);

    assert.ok(error instanceof ExecutionEnvProviderError);
    assert.strictEqual(error.code, "cloud_sandbox_unavailable");
  }),
);
