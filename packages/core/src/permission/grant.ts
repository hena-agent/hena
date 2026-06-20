import { Effect } from "effect";

import type { PendingRequestSuccess } from "../requestRegistry/types";
import { isAlwaysGranted, rememberAlwaysGrant } from "./request";
import {
  type PermissionEvent,
  type PermissionGrant,
  type PermissionRequest,
  PermissionRequestNotFound,
} from "./schema";
import type {
  PermissionRegistry,
  PermissionServiceShape,
  PermissionState,
} from "./types";

const grantRequest = (
  state: PermissionState,
  input: PermissionGrant,
  request: PermissionRequest,
): PendingRequestSuccess<void, PermissionEvent> => {
  const isAlways = input.scope === "always";
  const patterns = isAlways ? request.always : request.patterns;

  return {
    value: undefined,
    event: {
      type: "permission.granted",
      requestID: input.requestID,
      scope: input.scope,
      patterns,
    },
    ...(isAlways
      ? {
          commit: Effect.sync(() => {
            rememberAlwaysGrant(
              state.alwaysGranted,
              request.sessionID,
              request.permission,
              patterns,
            );
          }),
        }
      : {}),
  };
};

const grantPendingAlways = Effect.fnUntraced(function* (
  state: PermissionState,
  registry: PermissionRegistry,
) {
  const pending = yield* registry.list();
  yield* Effect.forEach(
    pending.filter((request) => isAlwaysGranted(state.alwaysGranted, request)),
    (request) =>
      registry
        .succeed(
          request.id,
          new PermissionRequestNotFound({ requestID: request.id }),
          (matched) =>
            Effect.succeed(
              grantRequest(
                state,
                { requestID: matched.id, scope: "always" },
                matched,
              ),
            ),
        )
        .pipe(Effect.ignore),
    { discard: true },
  );
});

export const makeGrant = (
  state: PermissionState,
  registry: PermissionRegistry,
): PermissionServiceShape["grant"] =>
  Effect.fnUntraced(function* (input: PermissionGrant) {
    yield* registry.succeed(
      input.requestID,
      new PermissionRequestNotFound({ requestID: input.requestID }),
      (request) => Effect.succeed(grantRequest(state, input, request)),
    );
    if (input.scope === "always") {
      yield* grantPendingAlways(state, registry);
    }
  });
