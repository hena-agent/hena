import { Effect, Stream } from "effect";

import { type BoundedUtf8Text, decodeBoundedUtf8Bytes } from "./textBounds";

const concatBytes = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
};

export const collectBoundedUtf8Stream = <Error, Requirements>(
  stream: Stream.Stream<Uint8Array, Error, Requirements>,
  maxBytes: number,
): Effect.Effect<BoundedUtf8Text, Error, Requirements> => {
  let emitted = 0;
  const maxReadBytes = maxBytes + 1;

  return stream.pipe(
    Stream.map((chunk): Uint8Array => {
      const remaining = maxReadBytes - emitted;
      const selected =
        chunk.byteLength <= remaining ? chunk : chunk.slice(0, remaining);
      emitted += selected.byteLength;
      return selected;
    }),
    Stream.takeUntil((): boolean => emitted >= maxReadBytes),
    Stream.runCollect,
    Effect.map((chunks) =>
      decodeBoundedUtf8Bytes(concatBytes(chunks), maxBytes),
    ),
  );
};
