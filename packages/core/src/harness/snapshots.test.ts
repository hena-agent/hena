import { assert, it } from "@effect/vitest";

import { snapshotResources } from "./snapshots";

it("snapshots prompt templates without skills", () => {
  const resources = snapshotResources({
    promptTemplates: [{ name: "fix", content: "Fix {0}" }],
  });

  assert.deepStrictEqual(resources, {
    promptTemplates: [{ name: "fix", content: "Fix {0}" }],
  });
});
