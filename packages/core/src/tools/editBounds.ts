import { Effect, type FileSystem } from "effect";

import { ToolInputError } from "./toolErrors";

const maxEditBytes = 1024 * 1024;

const tooLarge = (message: string): ToolInputError =>
  new ToolInputError({ message });

const isHighSurrogate = (code: number): boolean =>
  code >= 0xd800 && code <= 0xdbff;

const isLowSurrogate = (code: number): boolean =>
  code >= 0xdc00 && code <= 0xdfff;

const utf8CharSize = (
  text: string,
  index: number,
): { readonly bytes: number; readonly nextIndex: number } => {
  const code = text.charCodeAt(index);
  if (code < 0x80) {
    return { bytes: 1, nextIndex: index + 1 };
  }
  if (code < 0x800) {
    return { bytes: 2, nextIndex: index + 1 };
  }
  if (isHighSurrogate(code) && index + 1 < text.length) {
    const next = text.charCodeAt(index + 1);
    return isLowSurrogate(next)
      ? { bytes: 4, nextIndex: index + 2 }
      : { bytes: 3, nextIndex: index + 1 };
  }
  return { bytes: 3, nextIndex: index + 1 };
};

const countUtf8Bytes = (text: string): number | undefined => {
  let bytes = 0;
  let index = 0;
  while (index < text.length) {
    const char = utf8CharSize(text, index);
    bytes += char.bytes;
    if (bytes > maxEditBytes) {
      return undefined;
    }
    index = char.nextIndex;
  }
  return bytes;
};

export const ensureEditSize = (
  bytes: number | FileSystem.Size,
  message: string,
): Effect.Effect<void, ToolInputError> =>
  Number(bytes) > maxEditBytes ? Effect.fail(tooLarge(message)) : Effect.void;

export const measureEditTextBytes = (
  text: string,
  message: string,
): Effect.Effect<number, ToolInputError> => {
  if (text.length > maxEditBytes) {
    return Effect.fail(tooLarge(message));
  }
  const bytes = countUtf8Bytes(text);
  return bytes === undefined
    ? Effect.fail(tooLarge(message))
    : Effect.succeed(bytes);
};
