import { Context, Effect, Layer } from "effect";

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
  const registry = yield* makePendingRequestRegistry<
    PermissionAskInput,
    PermissionRequest,
    void,
    PermissionDeniedError,
    PermissionEvent
  >({
    idPrefix: "per",
    makeRequest,
    snapshotRequest: snapshotPermissionRequest,
    askedEvent: (request: PermissionRequest): PermissionEvent => ({
      type: "permission.asked",
      request,
    }),
    rejectOnShutdown: (request: PermissionRequest) => denyRequest(request, ""),
  });

  const ask = Effect.fnUntraced(function* (input: PermissionAskInput) {
    if (isAlwaysGranted(state.alwaysGranted, input)) {
      return;
    }

    return yield* registry.ask(input);
  });

  return {
    ask,
    deny: makeDeny(registry),
    events: registry.events,
    grant: makeGrant(state, registry),
    list: registry.list,
  } satisfies PermissionServiceShape;
});

export class PermissionService extends Context.Service<
  PermissionService,
  PermissionServiceShape
>()("@hena-dev/core/PermissionService") {
  static readonly Live = Layer.effect(this)(makePermissionService());
}
