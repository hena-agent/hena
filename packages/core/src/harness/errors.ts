import * as PiAgent from "@earendil-works/pi-agent-core";
import { Schema } from "effect";

const HarnessServiceErrorCode = Schema.Literals([
  "busy",
  "invalid_state",
  "invalid_argument",
  "session",
  "hook",
  "auth",
  "compaction",
  "branch_summary",
  "unknown",
]);

export class HarnessServiceError extends Schema.TaggedErrorClass<HarnessServiceError>()(
  "HarnessServiceError",
  {
    code: HarnessServiceErrorCode,
    message: Schema.String,
    cause: Schema.optional(Schema.Unknown),
  },
) {}

const errorMessage = (cause: unknown): string => {
  if (cause instanceof Error) {
    return cause.message;
  }
  return String(cause);
};

export const normalizeHarnessError = (cause: unknown): HarnessServiceError => {
  if (cause instanceof PiAgent.AgentHarnessError) {
    return new HarnessServiceError({
      code: cause.code,
      message: cause.message,
      cause: cause.cause,
    });
  }

  return new HarnessServiceError({
    code: "unknown",
    message: errorMessage(cause),
    cause,
  });
};
