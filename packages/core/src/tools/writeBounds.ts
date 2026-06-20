import { Effect } from "effect";

import { ToolInputError } from "./toolErrors";

const encoder = new TextEncoder();
const maxWriteBytes = 1024 * 1024;

export const writeContentBytes = (
  content: string,
): Effect.Effect<number, ToolInputError> => {
  const bytes = encoder.encode(content).length;
  return bytes > maxWriteBytes
    ? Effect.fail(
        new ToolInputError({ message: "File is too large to write." }),
      )
    : Effect.succeed(bytes);
};
