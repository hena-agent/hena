import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { makeRuntime } from "../runtime/runtime";

const directory = fileURLToPath(
  new URL("../../.tmp-extension", import.meta.url),
);

const writeExtension = (name: string, content: string) =>
  Effect.tryPromise(async () => {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, name), content);
  }).pipe(Effect.as(join(directory, name)));

const cleanup = Effect.tryPromise(async () => {
  await rm(directory, { force: true, recursive: true });
}).pipe(Effect.asVoid);

it.live("loads and unloads a Bun TypeScript extension", () =>
  Effect.acquireUseRelease(
    writeExtension(
      "loaded-extension.ts",
      `export default (api) => api.systemPrompt.contribute({ content: "loaded" });`,
    ),
    (path) =>
      Effect.gen(function* () {
        const runtime = yield* makeRuntime;
        const extension = yield* runtime.loadExtension(path);

        assert.strictEqual(yield* runtime.systemPrompt.text, "loaded");
        yield* extension.unload;
        assert.strictEqual(yield* runtime.systemPrompt.text, "");
      }),
    () => cleanup,
  ),
);

it.live("rejects modules without a default extension factory", () =>
  Effect.acquireUseRelease(
    writeExtension("invalid-extension.ts", `export const nope = 1;`),
    (path) =>
      Effect.gen(function* () {
        const runtime = yield* makeRuntime;
        const error = yield* runtime.loadExtension(path).pipe(Effect.flip);

        assert.strictEqual(error._tag, "InvalidExtensionModule");
      }),
    () => cleanup,
  ),
);

it.live("rejects missing extension modules", () =>
  Effect.gen(function* () {
    yield* cleanup;
    const runtime = yield* makeRuntime;
    const error = yield* runtime
      .loadExtension(join(directory, "missing.ts"))
      .pipe(Effect.flip);

    assert.strictEqual(error._tag, "InvalidExtensionModule");
  }),
);

it.live("rejects failing extension factories", () =>
  Effect.acquireUseRelease(
    writeExtension(
      "failing-extension.ts",
      `import { Effect } from "effect"; export default () => Effect.fail("bad");`,
    ),
    (path) =>
      Effect.gen(function* () {
        const runtime = yield* makeRuntime;
        const error = yield* runtime.loadExtension(path).pipe(Effect.flip);

        assert.strictEqual(error._tag, "InvalidExtensionModule");
      }),
    () => cleanup,
  ),
);

it.live("rejects factories that do not return Effects", () =>
  Effect.acquireUseRelease(
    writeExtension("non-effect-extension.ts", `export default () => 1;`),
    (path) =>
      Effect.gen(function* () {
        const runtime = yield* makeRuntime;
        const error = yield* runtime.loadExtension(path).pipe(Effect.flip);

        assert.strictEqual(error._tag, "InvalidExtensionModule");
      }),
    () => cleanup,
  ),
);
