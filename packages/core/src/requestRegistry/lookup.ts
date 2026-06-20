import { Effect } from "effect";

import type { PendingRequestMap } from "./settlement";
import type { PendingRequestEntry } from "./types";

export const getPendingRequest = <Request, Value, Failure, NotFound>(
  pending: PendingRequestMap<Request, Value, Failure>,
  requestID: string,
  notFound: NotFound,
): Effect.Effect<PendingRequestEntry<Request, Value, Failure>, NotFound> =>
  Effect.sync(() => pending.get(requestID)).pipe(
    Effect.flatMap((entry) =>
      entry === undefined ? Effect.fail(notFound) : Effect.succeed(entry),
    ),
  );
