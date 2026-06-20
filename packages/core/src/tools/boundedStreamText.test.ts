import { assert, it } from "@effect/vitest";
import { Effect, Stream } from "effect";

import { collectBoundedUtf8Stream } from "./boundedStreamText";

it.effect("stops reading stream chunks after the byte cap sentinel", () =>
  Effect.gen(function* () {
    let pulls = 0;
    const chunk = new TextEncoder().encode("xx");
    const stream = Stream.make(chunk, chunk, chunk).pipe(
      Stream.tap(() =>
        Effect.sync(() => {
          pulls += 1;
        }),
      ),
    );

    const result = yield* collectBoundedUtf8Stream(stream, 3);

    assert.deepStrictEqual(result, { bytes: 4, text: "xxx", truncated: true });
    assert.strictEqual(pulls, 2);
  }),
);

it.effect("slices a chunk that crosses the byte cap sentinel", () =>
  Effect.gen(function* () {
    const stream = Stream.make(new TextEncoder().encode("xxxxx"));

    const result = yield* collectBoundedUtf8Stream(stream, 3);

    assert.deepStrictEqual(result, { bytes: 4, text: "xxx", truncated: true });
  }),
);
