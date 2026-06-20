import type * as PiAgent from "@earendil-works/pi-agent-core";
import type * as PiAi from "@earendil-works/pi-ai";
import type { Effect } from "effect";

export interface AutoCompactionConfig {
  readonly compaction?: {
    readonly auto?: boolean;
    readonly reserved?: number;
  };
}

export type ActiveSessionPathEntries = ReadonlyArray<PiAgent.SessionTreeEntry>;

export interface ContextUsageInput {
  readonly activePathEntries: ActiveSessionPathEntries;
  readonly config?: AutoCompactionConfig;
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

export interface AutoCompactionRuntime<E = never> {
  readonly compact: (
    instructions?: string,
  ) => Effect.Effect<PiAgent.CompactResult, E>;
}

export interface AutoCompactionInput<E = never> extends ContextUsageInput {
  readonly instructions?: string;
  readonly runtime: AutoCompactionRuntime<E>;
}

export type AutoCompactionResult =
  | { readonly compacted: false; readonly usage: ContextUsage }
  | {
      readonly compacted: true;
      readonly result: PiAgent.CompactResult;
      readonly usage: ContextUsage;
    };
