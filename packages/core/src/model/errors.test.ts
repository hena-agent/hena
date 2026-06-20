import { assert, it } from "@effect/vitest";

import { ModelNotFoundError } from "./errors";

it("constructs model not found errors", () => {
  const error = new ModelNotFoundError({
    provider: "openai",
    modelId: "missing",
  });

  assert.strictEqual(error._tag, "ModelNotFound");
  assert.strictEqual(error.provider, "openai");
  assert.strictEqual(error.modelId, "missing");
});
