import type { Effect } from "effect";
import { Ref } from "effect";
import type { TranscriptEntry } from "../transcript/transcript";
import type { SessionState } from "./state";

export const transcriptSnapshot = (
  state: SessionState,
): Effect.Effect<readonly TranscriptEntry[]> => Ref.get(state.entries);
