import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { editContent } from "./editOperations";

it.effect("rejects an empty search string", () =>
  Effect.gen(function* () {
    const exit = yield* editContent("content", "", "next").pipe(Effect.exit);

    assert.strictEqual(exit._tag, "Failure");
  }),
);

it.effect("edits content that exactly equals the search string", () =>
  Effect.gen(function* () {
    const result = yield* editContent("before", "before", "after");

    assert.deepStrictEqual(result, { content: "after", replacements: 1 });
  }),
);

it.effect("preserves dollar sequences in replacements literally", () =>
  Effect.gen(function* () {
    const result = yield* editContent(
      "before TOKEN after",
      "TOKEN",
      "$&-$1-$$",
    );

    assert.deepStrictEqual(result, {
      content: "before $&-$1-$$ after",
      replacements: 1,
    });
  }),
);
