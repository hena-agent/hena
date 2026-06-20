import { type Deferred, Effect, Option } from "effect";

import { type PendingRequestStore, publish, snapshotRequest } from "./store";

export type AskInstallation<Request, Value, Failure> =
  | { readonly _tag: "closed"; readonly failure: Failure }
  | {
      readonly _tag: "installed";
      readonly deferred: Deferred.Deferred<Value, Failure>;
      readonly request: Request;
      readonly requestID: string;
    }
  | { readonly _tag: "resolved"; readonly value: Value };

export const installRequest = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  input: Input,
  deferred: Deferred.Deferred<Value, Failure>,
): AskInstallation<Request, Value, Failure> => {
  const resolved = store.options.resolveBeforeInstall?.(input);
  if (resolved !== undefined && Option.isSome(resolved)) {
    return { _tag: "resolved", value: resolved.value };
  }

  const id = `${store.options.idPrefix}-${store.nextID}`;
  store.nextID += 1;
  const request = store.options.makeRequest(id, input);
  if (store.closed) {
    return {
      _tag: "closed",
      failure: store.options.rejectOnShutdown(request).failure,
    };
  }
  store.pending.set(id, { deferred, request });
  return { _tag: "installed", deferred, request, requestID: id };
};

export const publishAsked = <
  Input,
  Request extends { readonly id: string },
  Value,
  Failure,
  Event,
>(
  store: PendingRequestStore<Input, Request, Value, Failure, Event>,
  next: AskInstallation<Request, Value, Failure>,
): Effect.Effect<AskInstallation<Request, Value, Failure>> =>
  next._tag === "installed"
    ? publish(
        store,
        store.options.askedEvent(snapshotRequest(store, next.request)),
      ).pipe(Effect.as(next))
    : Effect.succeed(next);
