import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { rejectInterruptedEntry } from "./interruption";
import type { PendingRequestMap } from "./settlement";

interface Request {
  readonly id: string;
}

it.effect("ignores interruption for a missing pending request", () =>
  Effect.gen(function* () {
    const events: Array<string> = [];
    const pending: PendingRequestMap<Request, string, string> = new Map();

    yield* rejectInterruptedEntry(
      pending,
      "req-missing",
      {
        idPrefix: "req",
        askedEvent: (request) => request.id,
        makeRequest: (id) => ({ id }),
        rejectOnShutdown: (request) => ({
          failure: "closed",
          event: request.id,
        }),
      },
      (event) => Effect.sync(() => events.push(event)),
    );

    assert.deepStrictEqual(events, []);
  }),
);
