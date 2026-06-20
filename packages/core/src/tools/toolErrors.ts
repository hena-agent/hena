import { Schema } from "effect";
import type { PlatformError } from "effect/PlatformError";

import type { PathGuardError } from "../path/PathGuard";

export class ToolInputError extends Schema.TaggedErrorClass<ToolInputError>()(
  "ToolInputError",
  { message: Schema.String },
) {}

export type ToolExecutionError =
  | Error
  | PathGuardError
  | PlatformError
  | ToolInputError;
