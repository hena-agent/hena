import { Schema } from "effect";
import type { PlatformError } from "effect/PlatformError";

import type { PathGuardError } from "../path/PathGuard";
import type { QuestionRejectedError } from "../question/schema";

export class ToolInputError extends Schema.TaggedErrorClass<ToolInputError>()(
  "ToolInputError",
  { message: Schema.String },
) {}

export class ToolHttpError extends Schema.TaggedErrorClass<ToolHttpError>()(
  "ToolHttpError",
  { message: Schema.String },
) {}

export class ToolShellError extends Schema.TaggedErrorClass<ToolShellError>()(
  "ToolShellError",
  {
    code: Schema.Literals([
      "aborted",
      "timeout",
      "shell_unavailable",
      "spawn_error",
      "callback_error",
      "unknown",
    ]),
    message: Schema.String,
  },
) {}

export type ToolExecutionError =
  | PathGuardError
  | PlatformError
  | QuestionRejectedError
  | ToolHttpError
  | ToolInputError
  | ToolShellError;
