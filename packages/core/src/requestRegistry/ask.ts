import { Deferred, Effect } from "effect";

import { rejectInterruptedEntry } from "./interruption";
import type { PendingRequestMap } from "./settlement";
import type {
  PendingRequestPublish,
  PendingRequestRegistryOptions,
} from "./types";

export const makeAsk = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  pending: PendingRequestMap<Request, Value, Failure>,
  options: PendingRequestRegistryOptions<Input, Request, Failure, Event>,
  publish: PendingRequestPublish<Event>,
  allocateID: () => string,
): ((input: Input) => Effect.Effect<Value, Failure>) =>
  Effect.fnUntraced(function* (input: Input) {
    const id = allocateID();
    const deferred = yield* Deferred.make<Value, Failure>();
    const request = options.makeRequest(id, input);

    const install = Effect.sync(() => {
      pending.set(id, { deferred, request });
    }).pipe(
      Effect.andThen(publish(options.askedEvent(request))),
      Effect.uninterruptible,
    );
    const cleanup = Effect.sync(() => {
      pending.delete(id);
    });
    const rejectOnInterrupt = rejectInterruptedEntry(
      pending,
      id,
      options,
      publish,
    );

    return yield* install.pipe(
      Effect.andThen(Deferred.await(deferred)),
      Effect.onInterrupt(() => rejectOnInterrupt),
      Effect.ensuring(cleanup),
    );
  });
