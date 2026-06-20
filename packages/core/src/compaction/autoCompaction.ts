import * as PiAgent from "@earendil-works/pi-agent-core";
import type * as PiAi from "@earendil-works/pi-ai";
import { Effect } from "effect";

import type {
  AutoCompactionConfig,
  AutoCompactionInput,
  AutoCompactionResult,
  ContextUsage,
  ContextUsageInput,
} from "./types";

export const COMPACTION_BUFFER = 20_000;

export const getCompactionReserve = (
  model: PiAi.Model<PiAi.Api>,
  config: AutoCompactionConfig = {},
): number =>
  config.compaction?.reserved ?? Math.min(COMPACTION_BUFFER, model.maxTokens);

export const shouldAutoCompact = (
  tokens: number,
  model: PiAi.Model<PiAi.Api>,
  config: AutoCompactionConfig = {},
): boolean => {
  if (config.compaction?.auto === false || model.contextWindow === 0) {
    return false;
  }
  return PiAgent.shouldCompact(tokens, model.contextWindow, {
    enabled: true,
    keepRecentTokens: COMPACTION_BUFFER,
    reserveTokens: getCompactionReserve(model, config),
  });
};

const lastIndex = (
  entries: ReadonlyArray<PiAgent.SessionTreeEntry>,
  type: PiAgent.SessionTreeEntry["type"],
): number => {
  for (let index: number = entries.length - 1; index >= 0; index--) {
    if (entries[index]?.type === type) {
      return index;
    }
  }
  return -1;
};

const isAlreadyCompacted = (
  entries: ReadonlyArray<PiAgent.SessionTreeEntry>,
): boolean => {
  const compactionIndex = lastIndex(entries, "compaction");
  const messageIndex = lastIndex(entries, "message");
  return compactionIndex >= 0 && messageIndex <= compactionIndex;
};

export const getContextUsage = (input: ContextUsageInput): ContextUsage => {
  const entries = [...input.activePathEntries];
  const usage = PiAgent.getLastAssistantUsage(entries);
  const source = usage === undefined ? "estimate" : "usage";
  const tokens =
    usage === undefined
      ? PiAgent.estimateContextTokens(
          PiAgent.buildSessionContext(entries).messages,
        ).tokens
      : PiAgent.calculateContextTokens(usage);
  const reserve = getCompactionReserve(input.model, input.config);
  const usable = Math.max(0, input.model.contextWindow - reserve);
  return {
    auto: input.config?.compaction?.auto !== false,
    contextWindow: input.model.contextWindow,
    overflow:
      !isAlreadyCompacted(input.activePathEntries) &&
      shouldAutoCompact(tokens, input.model, input.config),
    reserve,
    source,
    tokens,
    usable,
  };
};

export const autoCompactAfterTurn: <E>(
  input: AutoCompactionInput<E>,
) => Effect.Effect<AutoCompactionResult, E> = Effect.fnUntraced(
  function* (input) {
    const usage = getContextUsage(input);
    if (!usage.overflow) {
      return { compacted: false, usage };
    }
    const result = yield* input.runtime.compact(input.instructions);
    return { compacted: true, result, usage };
  },
);
