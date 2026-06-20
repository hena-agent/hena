import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { assert, it } from "@effect/vitest";

const sourceRoot = fileURLToPath(new URL(".", import.meta.url));

const collectSourceFiles = (directory: string): ReadonlyArray<string> =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(path);
    }

    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".test.ts")) {
      return [];
    }

    return [path];
  });

const forbiddenPatterns = [
  { name: "async", pattern: /\basync\b/ },
  { name: "await", pattern: /(^|[^\w.])await\b/ },
  { name: "try block", pattern: /\btry\s*\{/ },
  { name: "catch block", pattern: /\bcatch\s*\(/ },
  { name: "Date.now", pattern: /\bDate\.now\b/ },
  { name: "new Date", pattern: /\bnew\s+Date\b/ },
] as const;

const stripComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

it("keeps production Effect code free of imperative async and time APIs", () => {
  const offenders = collectSourceFiles(sourceRoot).flatMap((file) => {
    const source = stripComments(readFileSync(file, "utf8"));
    return forbiddenPatterns
      .filter(({ pattern }) => pattern.test(source))
      .map(({ name }) => `${relative(sourceRoot, file)}: ${name}`);
  });

  assert.deepStrictEqual(offenders, []);
});
