import * as PiAgent from "@earendil-works/pi-agent-core";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { getSessionID, SessionMetadataError } from "./sessionID";

const makeSession = (sessionID: string): Effect.Effect<PiAgent.Session> =>
  Effect.promise(async () =>
    new PiAgent.InMemorySessionRepo().create({ id: sessionID }),
  );

it.effect("reads the session id from metadata", () =>
  Effect.gen(function* () {
    const session = yield* makeSession("ses_ok");

    assert.strictEqual(yield* getSessionID(session), "ses_ok");
  }),
);

it.effect("maps metadata failures to typed errors", () =>
  Effect.gen(function* () {
    const session = Object.assign(yield* makeSession("ses_fail"), {
      getMetadata: async () => {
        await Promise.resolve();
        throw new Error("metadata failed");
      },
    });
    const error = yield* getSessionID(session).pipe(Effect.flip);

    assert.ok(error instanceof SessionMetadataError);
    assert.strictEqual(error.message, "metadata failed");
  }),
);
