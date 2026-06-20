import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { compileGlobEffect } from "./globMatch";
import { ToolInputError } from "./toolErrors";

it.effect("matches common glob patterns", () =>
  Effect.gen(function* () {
    const ts = yield* compileGlobEffect("*.ts");
    const nestedTs = yield* compileGlobEffect("**/*.ts");
    const source = yield* compileGlobEffect("src/**");
    const single = yield* compileGlobEffect("src/?.ts");
    const extension = yield* compileGlobEffect("*.{ts,tsx}");
    const classMatch = yield* compileGlobEffect("src/[ab].ts");

    assert.strictEqual(ts("index.ts"), true);
    assert.strictEqual(ts("src/index.ts"), false);
    assert.strictEqual(nestedTs("index.ts"), true);
    assert.strictEqual(nestedTs("src/index.ts"), true);
    assert.strictEqual(source("src/a/b.txt"), true);
    assert.strictEqual(single("src/a.ts"), true);
    assert.strictEqual(single("src/long.ts"), false);
    assert.strictEqual(extension("index.tsx"), true);
    assert.strictEqual(classMatch("src/a.ts"), true);
  }),
);

it.effect("maps glob compiler failures to tool input errors", () =>
  Effect.gen(function* () {
    const error = yield* compileGlobEffect("[", {
      compile: () => {
        throw new Error("bad glob");
      },
    }).pipe(Effect.flip);

    assert.ok(error instanceof ToolInputError);
    assert.strictEqual(error.message, "bad glob");
  }),
);
