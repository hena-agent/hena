import { Effect } from "effect";
import type {
  PendingRequestFailure,
  PendingRequestSuccess,
} from "../requestRegistry/types";
import { rememberAlwaysGrant } from "./request";
import {
  PermissionDeniedError,
  type PermissionDeny,
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

export const denyRequest = (
  request: PermissionRequest,
  message: string,
): PendingRequestFailure<PermissionDeniedError, PermissionEvent> => ({
  failure: new PermissionDeniedError({
    requestID: request.id,
    message,
  }),
  event: {
    type: "permission.denied",
    requestID: request.id,
    message,
  },
});

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

export const makeGrant = (
  state: PermissionState,
  registry: PermissionRegistry,
): PermissionServiceShape["grant"] =>
  Effect.fnUntraced(function* (input: PermissionGrant) {
    yield* registry.succeed(
      input.requestID,
      new PermissionRequestNotFound({
        requestID: input.requestID,
      }),
      (request) => Effect.succeed(grantRequest(state, input, request)),
    );
  });

export const makeDeny = (
  registry: PermissionRegistry,
): PermissionServiceShape["deny"] =>
  Effect.fnUntraced(function* (input: PermissionDeny) {
    const message = input.message ?? "";
    yield* registry.fail(
      input.requestID,
      new PermissionRequestNotFound({
        requestID: input.requestID,
      }),
      (request) => Effect.succeed(denyRequest(request, message)),
    );
  });
