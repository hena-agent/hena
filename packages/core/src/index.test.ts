import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  AgentHarnessFactory,
  collectProjectInstructions,
  corePackageName,
  corePackageNameEffect,
  ExecutionEnvProvider,
  HarnessService,
  Info,
  makeSessionRuntimeLayer,
  PermissionGrant,
  PermissionService,
  QuestionService,
  Reply,
  SessionRuntimeMap,
} from "./index";

it("exposes the core package name", () => {
  assert.strictEqual(corePackageName, "@hena-dev/core");
});

it.effect("yields the core package name as an Effect", () =>
  Effect.gen(function* () {
    assert.strictEqual(yield* corePackageNameEffect, "@hena-dev/core");
  }),
);

it("exports core session runtime building blocks", () => {
  assert.strictEqual(typeof collectProjectInstructions, "function");
  assert.strictEqual(typeof makeSessionRuntimeLayer, "function");
  assert.ok(AgentHarnessFactory.Live);
  assert.ok(SessionRuntimeMap.layer);
  assert.ok(ExecutionEnvProvider.Local);
  assert.ok(HarnessService);
  assert.ok(Info);
  assert.ok(PermissionGrant);
  assert.ok(QuestionService.Live);
  assert.ok(Reply);
  assert.ok(PermissionService.Live);
});
