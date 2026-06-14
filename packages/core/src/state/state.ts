import type { Ref } from "effect";
import type { TranscriptEntry } from "../transcript/transcript";

export type SessionState = {
  readonly entries: Ref.Ref<readonly TranscriptEntry[]>;
  readonly entryCounter: Ref.Ref<number>;
  readonly id: string;
  readonly sequence: Ref.Ref<number>;
};
