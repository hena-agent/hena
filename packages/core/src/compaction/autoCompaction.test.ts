import type * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  autoCompactAfterTurn,
  COMPACTION_BUFFER,
  getCompactionReserve,
  getContextUsage,
  shouldAutoCompact,
} from "./autoCompaction";
import type { AutoCompactionRuntime } from "./types";

const model = {
  ...PiAi.getModel("openai", "gpt-4o-mini"),
  contextWindow: 100_000,
  maxTokens: 4_096,
};

const usage = (totalTokens: number): PiAi.Usage => ({
  input: 1,
  output: 2,
  cacheRead: 3,
  cacheWrite: 4,
  totalTokens,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
});

const assistantMessage = (totalTokens: number): PiAi.AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text: "done" }],
  api: model.api,
  provider: model.provider,
  model: model.id,
  usage: usage(totalTokens),
  stopReason: "stop",
  timestamp: 1,
});

const userMessage = (content: string): PiAi.UserMessage => ({
  role: "user",
  content,
  timestamp: 1,
});

const messageEntry = (
  id: string,
  message: PiAgent.AgentMessage,
): PiAgent.SessionTreeEntry => ({
  type: "message",
  id,
  parentId: null,
  timestamp: "2026-01-01T00:00:00.000Z",
  message,
});

const compactionEntry = (id: string): PiAgent.SessionTreeEntry => ({
  type: "compaction",
  id,
  parentId: null,
  timestamp: "2026-01-01T00:00:00.000Z",
  summary: "summary",
  firstKeptEntryId: "msg-1",
  tokensBefore: 96_000,
});

it("uses opencode reserve policy by default", () => {
  assert.strictEqual(COMPACTION_BUFFER, 20_000);
  assert.strictEqual(getCompactionReserve(model), 4_096);
  assert.strictEqual(
    getCompactionReserve({ ...model, maxTokens: 40_000 }),
    20_000,
  );
  assert.strictEqual(
    getCompactionReserve(model, { compaction: { reserved: 512 } }),
    512,
  );
  assert.strictEqual(
    getCompactionReserve(model, { compaction: { reserved: -1 } }),
    4_096,
  );
  assert.strictEqual(
    getCompactionReserve(model, { compaction: { reserved: Number.NaN } }),
    4_096,
  );
});

it("computes context usage from the last assistant usage", () => {
  const context = getContextUsage({
    activePathEntries: [messageEntry("msg-1", assistantMessage(96_000))],
    model,
  });

  assert.strictEqual(context.tokens, 96_000);
  assert.strictEqual(context.usable, 95_904);
  assert.strictEqual(context.source, "usage");
  assert.strictEqual(context.overflow, true);
});

it("falls back to estimating messages when no usage exists", () => {
  const context = getContextUsage({
    activePathEntries: [messageEntry("msg-1", userMessage("hello world"))],
    model,
  });

  assert.strictEqual(context.source, "estimate");
  assert.ok(context.tokens > 0);
  assert.strictEqual(context.overflow, false);
});

it("estimates context when entries were added after assistant usage", () => {
  const context = getContextUsage({
    activePathEntries: [
      messageEntry("msg-1", assistantMessage(96_000)),
      messageEntry("msg-2", userMessage("additional context")),
    ],
    model,
  });

  assert.strictEqual(context.source, "estimate");
  assert.ok(context.tokens > 0);
});

it("does not overflow when disabled or context window is unknown", () => {
  assert.strictEqual(
    shouldAutoCompact(96_000, model, { compaction: { auto: false } }),
    false,
  );
  assert.strictEqual(
    shouldAutoCompact(1, { ...model, contextWindow: 0 }),
    false,
  );
});

it.effect("compacts overflowing post-turn sessions", () =>
  Effect.gen(function* () {
    const calls: Array<string | undefined> = [];
    const runtime: AutoCompactionRuntime = {
      compact: (instructions) =>
        Effect.sync(() => {
          calls.push(instructions);
          return {
            summary: "summary",
            firstKeptEntryId: "msg-1",
            tokensBefore: 1,
          };
        }),
    };

    const result = yield* autoCompactAfterTurn({
      activePathEntries: [messageEntry("msg-1", assistantMessage(96_000))],
      instructions: "compact tightly",
      model,
      runtime,
    });

    assert.strictEqual(result.compacted, true);
    assert.deepStrictEqual(calls, ["compact tightly"]);
  }),
);

it.effect("skips compaction when the latest turn is already compacted", () =>
  Effect.gen(function* () {
    const runtime: AutoCompactionRuntime = {
      compact: () => Effect.die("compact should not run"),
    };
    const result = yield* autoCompactAfterTurn({
      activePathEntries: [
        messageEntry("msg-1", assistantMessage(96_000)),
        compactionEntry("cmp-1"),
      ],
      model,
      runtime,
    });

    assert.strictEqual(result.compacted, false);
    assert.strictEqual(result.usage.overflow, false);
  }),
);
