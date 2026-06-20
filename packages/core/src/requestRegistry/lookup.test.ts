import { assert, it } from "@effect/vitest";
import { Deferred, Effect } from "effect";

import { getPendingRequest } from "./lookup";
import type { PendingRequestMap } from "./settlement";

interface Request {
  readonly id: string;
}

it.effect("returns pending request entries by id", () =>
  Effect.gen(function* () {
    const deferred = yield* Deferred.make<string, string>();
    const entry = { request: { id: "req-1" }, deferred };
    const pending: PendingRequestMap<Request, string, string> = new Map([
      ["req-1", entry],
    ]);

    const found = yield* getPendingRequest(pending, "req-1", "missing");

    assert.strictEqual(found, entry);
  }),
);

it.effect("fails with the provided not found value", () =>
  Effect.gen(function* () {
    const pending: PendingRequestMap<Request, string, string> = new Map();

    const error = yield* getPendingRequest(
      pending,
      "req-missing",
      "missing",
    ).pipe(Effect.flip);

    assert.strictEqual(error, "missing");
  }),
);
