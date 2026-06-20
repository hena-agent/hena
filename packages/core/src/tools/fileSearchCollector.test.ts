import { assert, it } from "@effect/vitest";

import { makeFileSearchCollector } from "./fileSearchCollector";

it("tracks file-search fullness separately from truncation", () => {
  const collector = makeFileSearchCollector({
    limit: 1,
    matches: ({ relativePath }) => relativePath === "src/a.ts",
  });

  assert.strictEqual(collector.matches("/workspace/a.ts", "src\\a.ts"), true);
  collector.add("/workspace/a.ts");
  assert.strictEqual(collector.full, true);
  assert.strictEqual(collector.truncated, false);

  collector.add("/workspace/b.ts");
  assert.deepStrictEqual(collector.result(), {
    files: ["/workspace/a.ts"],
    truncated: true,
  });
});
