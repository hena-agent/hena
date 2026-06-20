import type * as PiAgent from "@earendil-works/pi-agent-core";
import type * as PiAi from "@earendil-works/pi-ai";
import type { Effect } from "effect";

export interface AutoCompactionConfig {
  readonly compaction?: {
    readonly auto?: boolean;
    readonly reserved?: number;
  };
}

export interface ContextUsageInput {
  readonly config?: AutoCompactionConfig;
  readonly entries: ReadonlyArray<PiAgent.SessionTreeEntry>;
  readonly model: PiAi.Model<PiAi.Api>;
}

export interface ContextUsage {
  readonly auto: boolean;
  readonly contextWindow: number;
  readonly overflow: boolean;
  readonly reserve: number;
  readonly source: "estimate" | "usage";
  readonly tokens: number;
  readonly usable: number;
}

export interface AutoCompactionRuntime {
  readonly compact: (
    instructions?: string,
  ) => Effect.Effect<PiAgent.CompactResult, unknown>;
}

export interface AutoCompactionInput extends ContextUsageInput {
  readonly instructions?: string;
  readonly runtime: AutoCompactionRuntime;
}

export type AutoCompactionResult =
  | { readonly compacted: false; readonly usage: ContextUsage }
  | {
      readonly compacted: true;
      readonly result: PiAgent.CompactResult;
      readonly usage: ContextUsage;
    };
