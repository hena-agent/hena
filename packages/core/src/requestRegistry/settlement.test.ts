import { assert, it } from "@effect/vitest";
import { Deferred, Effect } from "effect";

import { completeFailure, completeSuccess } from "./settlement";
import type { PendingRequestEntry } from "./types";

interface Request {
  readonly id: string;
}

const makeEntry = (): Effect.Effect<
  PendingRequestEntry<Request, string, string>
> =>
  Deferred.make<string, string>().pipe(
    Effect.map((deferred) => ({ request: { id: "req-1" }, deferred })),
  );

it.effect("completes successful settlements once", () =>
  Effect.gen(function* () {
    const events: Array<string> = [];
    let committed = false;
    const entry = yield* makeEntry();
    const pending = new Map([[entry.request.id, entry]]);

    yield* completeSuccess(
      {
        entry,
        pending,
        publish: (event) => Effect.sync(() => events.push(event)),
      },
      "missing",
      {
        value: "accepted",
        event: "resolved",
        commit: Effect.sync(() => {
          committed = true;
        }),
      },
    );

    assert.strictEqual(committed, true);
    assert.deepStrictEqual(events, ["resolved"]);
    assert.strictEqual(pending.has(entry.request.id), false);
    assert.strictEqual(yield* Deferred.await(entry.deferred), "accepted");
  }),
);

it.effect("completes failed settlements once", () =>
  Effect.gen(function* () {
    const events: Array<string> = [];
    const entry = yield* makeEntry();
    const pending = new Map([[entry.request.id, entry]]);

    yield* completeFailure(
      {
        entry,
        pending,
        publish: (event) => Effect.sync(() => events.push(event)),
      },
      "missing",
      { failure: "closed", event: "rejected" },
    );
    const exit = yield* Deferred.await(entry.deferred).pipe(Effect.exit);

    assert.deepStrictEqual(events, ["rejected"]);
    assert.strictEqual(pending.has(entry.request.id), false);
    assert.strictEqual(exit._tag, "Failure");
  }),
);

it.effect("rejects stale settlement entries", () =>
  Effect.gen(function* () {
    const entry = yield* makeEntry();
    const pending = new Map<
      string,
      PendingRequestEntry<Request, string, string>
    >();
    const context = { entry, pending, publish: () => Effect.void };

    const successError = yield* completeSuccess(context, "missing", {
      value: "accepted",
      event: "resolved",
    }).pipe(Effect.flip);
    const failureError = yield* completeFailure(context, "missing", {
      failure: "closed",
      event: "rejected",
    }).pipe(Effect.flip);

    assert.strictEqual(successError, "missing");
    assert.strictEqual(failureError, "missing");
  }),
);
