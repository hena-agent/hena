import type { Context, Fiber } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import type { CoreEvent } from "../events/events";
import type { CoreServices } from "../services/services";
import type { TranscriptEntry } from "../transcript/transcript";

export type Session = {
  readonly abort: () => void;
  readonly dispose: () => Promise<void>;
  /** Each new iteration replays this session's buffered events until disposed. */
  readonly events: AsyncIterable<CoreEvent>;
  readonly id: string;
  readonly prompt: (input: string) => Promise<void>;
  readonly transcript: () => readonly TranscriptEntry[];
};

export type ActiveRun = {
  readonly controller: AbortController;
  readonly fiber: Fiber.Fiber<void>;
};

export type MakeSessionOptions = {
  readonly context: Context.Context<CoreServices>;
  readonly id: string;
  readonly maxTurns: number;
  readonly onDispose: () => void;
  readonly runtime: ManagedRuntime<CoreServices, never>;
};
