import { assert, it } from "@effect/vitest";

import { makeShellAbortController } from "./shellOutputCapture";

it("copies pre-aborted shell signals", () => {
  const source = new AbortController();
  source.abort();

  const controller = makeShellAbortController(source.signal);

  assert.strictEqual(controller.signal.aborted, true);
});
