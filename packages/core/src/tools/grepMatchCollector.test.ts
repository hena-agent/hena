import { assert, it } from "@effect/vitest";

import {
  collectGrepMatch,
  makeGrepCollectionState,
} from "./grepMatchCollector";
import type { GrepMatch } from "./grepOperations";

const match = (text: string): GrepMatch => ({
  path: "/workspace/a.ts",
  line: 1,
  text,
});

it("collects repeated-path grep matches", () => {
  const matches = [match("first")];
  const state = makeGrepCollectionState();
  state.currentPath = "/workspace/a.ts";

  assert.strictEqual(collectGrepMatch(matches, state, match("second")), true);
  assert.deepStrictEqual(
    matches.map((entry) => entry.text),
    ["first", "second"],
  );
});

it("rejects matches when no output budget remains", () => {
  const matches: Array<GrepMatch> = [];
  const state = makeGrepCollectionState();
  state.bytes = 1024 * 1024;

  assert.strictEqual(collectGrepMatch(matches, state, match("needle")), false);
  assert.deepStrictEqual(matches, []);
});
