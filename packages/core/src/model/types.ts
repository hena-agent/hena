import type * as PiAgent from "@earendil-works/pi-agent-core";
import type * as PiAi from "@earendil-works/pi-ai";
import type { Effect } from "effect";

import type { DefaultModelNotFoundError, ModelNotFoundError } from "./errors";

export interface ModelRef {
  readonly provider: string;
  readonly modelId: string;
}

interface ProviderFilter {
  readonly models?: ReadonlyArray<string>;
}

export interface CustomModelConfig {
  readonly api?: PiAi.Api;
  readonly baseUrl: string;
  readonly contextWindow: number;
  readonly cost?: PiAi.Model<PiAi.Api>["cost"];
  readonly headers?: Readonly<Record<string, string>>;
  readonly id: string;
  readonly input?: ReadonlyArray<"text" | "image">;
  readonly maxTokens: number;
  readonly name?: string;
  readonly provider: string;
  readonly reasoning?: boolean;
  readonly thinkingLevelMap?: PiAi.ThinkingLevelMap;
}

export interface ModelRegistryConfig {
  readonly customModels?: ReadonlyArray<CustomModelConfig>;
  readonly default?: ModelRef;
  readonly providers?: Readonly<Record<string, ProviderFilter>>;
  readonly workspaceDefaults?: Readonly<Record<string, ModelRef>>;
}

export type HenaModel = PiAi.Model<PiAi.Api>;

export type HenaThinkingLevel = PiAgent.ThinkingLevel;

export interface ModelRegistryShape {
  readonly getDefaultModel: (
    workspaceID?: string,
  ) => Effect.Effect<HenaModel, DefaultModelNotFoundError | ModelNotFoundError>;
  readonly getModel: (
    ref: ModelRef,
  ) => Effect.Effect<HenaModel, ModelNotFoundError>;
  readonly getModels: (
    provider?: string,
  ) => Effect.Effect<ReadonlyArray<HenaModel>>;
}
