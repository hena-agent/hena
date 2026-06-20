import { assert, it } from "@effect/vitest";
import { Deferred, Effect } from "effect";

import { rejectEntries } from "./shutdown";
import type { PendingRequestEntry } from "./types";

interface Request {
  readonly id: string;
}

const makeEntry = (
  id: string,
): Effect.Effect<PendingRequestEntry<Request, string, string>> =>
  Deferred.make<string, string>().pipe(
    Effect.map((deferred) => ({ request: { id }, deferred })),
  );

it.effect("rejects every pending entry on shutdown", () =>
  Effect.gen(function* () {
    const committed: Array<string> = [];
    const events: Array<string> = [];
    const first = yield* makeEntry("req-1");
    const second = yield* makeEntry("req-2");

    yield* rejectEntries(
      [first, second],
      {
        idPrefix: "req",
        askedEvent: (request) => request.id,
        makeRequest: (id) => ({ id }),
        rejectOnShutdown: (request) => ({
          failure: "closed",
          event: request.id,
          commit: Effect.sync(() => {
            committed.push(request.id);
          }),
        }),
      },
      (event) => Effect.sync(() => events.push(event)),
    );

    const exits = yield* Effect.all([
      Deferred.await(first.deferred).pipe(Effect.exit),
      Deferred.await(second.deferred).pipe(Effect.exit),
    ]);

    assert.deepStrictEqual(committed, ["req-1", "req-2"]);
    assert.deepStrictEqual(events, ["req-1", "req-2"]);
    assert.deepStrictEqual(
      exits.map((exit) => exit._tag),
      ["Failure", "Failure"],
    );
  }),
);
