import type { Effect, Stream } from "effect";

import type { PendingRequestRegistry } from "../requestRegistry/types";
import type { ToolRef } from "../toolRef";

import type {
  PermissionDeniedError,
  PermissionDeny,
  PermissionEvent,
  PermissionGrant,
  PermissionMetadata,
  PermissionRequest,
  PermissionRequestNotFound,
} from "./schema";

export interface PermissionAskInput {
  readonly always: ReadonlyArray<string>;
  readonly capability?: string | undefined;
  readonly metadata: PermissionMetadata;
  readonly patterns: ReadonlyArray<string>;
  readonly permission: string;
  readonly sessionID: string;
  readonly tool?: ToolRef | undefined;
}

export interface PermissionServiceShape {
  readonly ask: (
    input: PermissionAskInput,
  ) => Effect.Effect<void, PermissionDeniedError>;
  readonly deny: (
    input: PermissionDeny,
  ) => Effect.Effect<void, PermissionRequestNotFound>;
  readonly events: Stream.Stream<PermissionEvent>;
  readonly grant: (
    input: PermissionGrant,
  ) => Effect.Effect<void, PermissionRequestNotFound>;
  readonly list: () => Effect.Effect<ReadonlyArray<PermissionRequest>>;
}

export type PermissionRegistry = PendingRequestRegistry<
  PermissionAskInput,
  PermissionRequest,
  void,
  PermissionDeniedError,
  PermissionEvent
>;

export interface PermissionState {
  readonly alwaysGranted: Set<string>;
}
