import type * as ModelTypes from "./types";

const defaultCost: ModelTypes.HenaModel["cost"] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

export const toModel = (
  config: ModelTypes.CustomModelConfig,
): ModelTypes.HenaModel => ({
  id: config.id,
  name: config.name ?? config.id,
  api: config.api ?? "openai-completions",
  provider: config.provider,
  baseUrl: config.baseUrl,
  reasoning: config.reasoning ?? false,
  input: [...(config.input ?? ["text"])],
  cost: config.cost ?? defaultCost,
  contextWindow: config.contextWindow,
  maxTokens: config.maxTokens,
  ...(config.thinkingLevelMap === undefined
    ? {}
    : { thinkingLevelMap: config.thinkingLevelMap }),
});
