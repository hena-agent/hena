import { readFileSync } from "node:fs";

import { assert, it } from "@effect/vitest";

const toolModules = [
  "BashTool.ts",
  "EditTool.ts",
  "GlobTool.ts",
  "GrepTool.ts",
  "QuestionTool.ts",
  "ReadTool.ts",
  "serviceAgentTool.ts",
  "WebfetchTool.ts",
  "WriteTool.ts",
] as const;

it("keeps JSON Schema typing inside the AgentTool boundary", () => {
  const offenders = toolModules.filter((file) =>
    readFileSync(new URL(file, import.meta.url), "utf8").includes("TSchema"),
  );

  assert.deepStrictEqual(offenders, []);
});

it("does not expose pi-ai TSchema as a core tool type", () => {
  const schemaAdapter = readFileSync(
    new URL("schema.ts", import.meta.url),
    "utf8",
  );

  assert.strictEqual(schemaAdapter.includes("TSchema"), false);
});
