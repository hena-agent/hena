import { Schema } from "effect";
import type { AiError } from "effect/unstable/ai";

export type RuntimeError =
  | AiError.AiError
  | MissingProvider
  | ResponsePartError
  | LoopLimitExceeded;

export class MissingProvider extends Schema.TaggedErrorClass<MissingProvider>()(
  "MissingProvider",
  {},
) {}

export class ResponsePartError extends Schema.TaggedErrorClass<ResponsePartError>()(
  "ResponsePartError",
  {
    error: Schema.Unknown,
  },
) {}

export class LoopLimitExceeded extends Schema.TaggedErrorClass<LoopLimitExceeded>()(
  "LoopLimitExceeded",
  {
    maxSteps: Schema.Number,
  },
) {}
