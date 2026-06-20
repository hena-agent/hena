import { assert, it } from "@effect/vitest";

import { mergeRuntimeSystemPromptConfig } from "./systemPromptConfig";

it("omits system prompt config when no inputs exist", () => {
  assert.strictEqual(mergeRuntimeSystemPromptConfig(undefined, []), undefined);
});

it("preserves configured prompt fields without discovered instructions", () => {
  assert.deepStrictEqual(
    mergeRuntimeSystemPromptConfig({ baseInstructions: "Base" }, []),
    { baseInstructions: "Base" },
  );
});

it("prepends discovered instructions before configured instructions", () => {
  assert.deepStrictEqual(
    mergeRuntimeSystemPromptConfig(
      { projectInstructions: [{ path: "/repo/manual.md", content: "Manual" }] },
      [{ path: "/repo/AGENTS.md", content: "Agents" }],
    ),
    {
      projectInstructions: [
        { path: "/repo/AGENTS.md", content: "Agents" },
        { path: "/repo/manual.md", content: "Manual" },
      ],
    },
  );
});
