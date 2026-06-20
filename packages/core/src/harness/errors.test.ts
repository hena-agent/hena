import * as PiAgent from "@earendil-works/pi-agent-core";
import { assert, it } from "@effect/vitest";

import { HarnessServiceError, normalizeHarnessError } from "./errors";

it("normalizes pi harness errors", () => {
  const cause = new Error("storage failed");
  const error = normalizeHarnessError(
    new PiAgent.AgentHarnessError("session", "session failed", cause),
  );

  assert.ok(error instanceof HarnessServiceError);
  assert.strictEqual(error.code, "session");
  assert.strictEqual(error.message, "session failed");
  assert.strictEqual(error.cause, cause);
});

it("normalizes unknown errors", () => {
  const error = normalizeHarnessError(new Error("unexpected"));
  const stringError = normalizeHarnessError("plain failure");

  assert.strictEqual(error.code, "unknown");
  assert.strictEqual(error.message, "unexpected");
  assert.strictEqual(stringError.code, "unknown");
  assert.strictEqual(stringError.message, "plain failure");
});
