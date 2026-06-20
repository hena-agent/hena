import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { compileGlobEffect, matchesGlob } from "./globMatch";
import { ToolInputError } from "./toolErrors";

it("matches common glob patterns", () => {
  assert.strictEqual(matchesGlob("*.ts", "index.ts"), true);
  assert.strictEqual(matchesGlob("*.ts", "src/index.ts"), false);
  assert.strictEqual(matchesGlob("**/*.ts", "index.ts"), true);
  assert.strictEqual(matchesGlob("**/*.ts", "src/index.ts"), true);
  assert.strictEqual(matchesGlob("src/**", "src/a/b.txt"), true);
  assert.strictEqual(matchesGlob("src/**/*.ts", "src/index.ts"), true);
  assert.strictEqual(matchesGlob("src/**/*.ts", "src/a/index.ts"), true);
  assert.strictEqual(matchesGlob("src/?.ts", "src/a.ts"), true);
  assert.strictEqual(matchesGlob("src/?.ts", "src/long.ts"), false);
  assert.strictEqual(matchesGlob("*.{ts,tsx}", "index.tsx"), true);
  assert.strictEqual(matchesGlob("src/[ab].ts", "src/a.ts"), true);
});

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
