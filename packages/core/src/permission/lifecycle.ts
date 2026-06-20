import { Effect } from "effect";
import type { PendingRequestFailure } from "../requestRegistry/types";
import {
  PermissionDeniedError,
  type PermissionDeny,
  type PermissionEvent,
  type PermissionRequest,
  PermissionRequestNotFound,
} from "./schema";
import type { PermissionRegistry, PermissionServiceShape } from "./types";

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
