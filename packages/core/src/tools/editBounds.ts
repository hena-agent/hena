import { Effect, type FileSystem } from "effect";

import { ToolInputError } from "./toolErrors";

const maxEditBytes = 1024 * 1024;

export const ensureEditSize = (
  bytes: number | FileSystem.Size,
  message: string,
): Effect.Effect<void, ToolInputError> =>
  Number(bytes) > maxEditBytes
    ? Effect.fail(new ToolInputError({ message }))
    : Effect.void;
