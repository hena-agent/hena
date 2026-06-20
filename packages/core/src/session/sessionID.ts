import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, Schema } from "effect";

export class SessionMetadataError extends Schema.TaggedErrorClass<SessionMetadataError>()(
  "SessionMetadataError",
  { message: Schema.String },
) {}

export const getSessionID = (
  session: PiAgent.Session,
): Effect.Effect<string, SessionMetadataError> =>
  Effect.tryPromise({
    // oxlint-disable-next-line typescript/promise-function-async
    try: () => session.getMetadata(),
    catch: (error: unknown) =>
      new SessionMetadataError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to read session metadata",
      }),
  }).pipe(Effect.map((metadata) => metadata.id));
