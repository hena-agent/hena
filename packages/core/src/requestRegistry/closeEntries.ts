import { Effect } from "effect";

import type { PendingRequestStore } from "./store";
import type { PendingRequestEntry } from "./types";

export const closeEntries = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
): Effect.Effect<Array<PendingRequestEntry<Request, Value, Failure>>> =>
  Effect.sync(() => {
    if (store.closed) {
      return [];
    }
    store.closed = true;
    const entries = [...store.pending.values(), ...store.settling.values()];
    store.pending.clear();
    store.settling.clear();
    store.cancelled.clear();
    return entries;
  });
