import { Context, Effect, Layer, Option, Semaphore } from "effect";

import { makePendingRequestRegistry } from "../requestRegistry/makePendingRequestRegistry";
import { makeGrant } from "./grant";
import { denyRequest, makeDeny } from "./lifecycle";
import {
  isAlwaysGranted,
  makeRequest,
  snapshotPermissionRequest,
} from "./request";
import type {
  PermissionDeniedError,
  PermissionEvent,
  PermissionRequest,
} from "./schema";
import type {
  PermissionAskInput,
  PermissionServiceShape,
  PermissionState,
} from "./types";

const makePermissionService = Effect.fnUntraced(function* () {
  const state: PermissionState = {
    alwaysGranted: new Set(),
  };
  const policyLock = yield* Semaphore.make(1);
  const guardInstall = <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E, R> => policyLock.withPermit(effect);
  const registry = yield* makePendingRequestRegistry<
    PermissionAskInput,
    PermissionRequest,
    void,
    PermissionDeniedError,
    PermissionEvent
  >({
    idPrefix: "per",
    guardInstall,
    makeRequest,
    resolveBeforeInstall: (input: PermissionAskInput) =>
      isAlwaysGranted(state.alwaysGranted, input)
        ? Option.some(undefined)
        : Option.none(),
    snapshotRequest: snapshotPermissionRequest,
    askedEvent: (request: PermissionRequest): PermissionEvent => ({
      type: "permission.asked",
      request,
    }),
    rejectOnShutdown: (request: PermissionRequest) => denyRequest(request, ""),
  });

  const ask = registry.ask;

  return {
    ask,
    deny: makeDeny(registry),
    events: registry.events,
    grant: makeGrant(state, registry, policyLock),
    list: registry.list,
  } satisfies PermissionServiceShape;
});

export class PermissionService extends Context.Service<
  PermissionService,
  PermissionServiceShape
>()("@hena-dev/core/PermissionService") {
  static readonly Live = Layer.effect(this)(makePermissionService());
}
