import { Effect } from "effect";

import type { PendingRequestEntry } from "./types";

export const takePending = <
  Request extends { readonly id: string },
  Value,
  Failure,
>(
  store: {
    readonly pending: Map<string, PendingRequestEntry<Request, Value, Failure>>;
  },
  requestID: string,
): Effect.Effect<PendingRequestEntry<Request, Value, Failure> | undefined> =>
  Effect.sync(() => {
    const entry = store.pending.get(requestID);
    store.pending.delete(requestID);
    return entry;
  });
