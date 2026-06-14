import type { Effect } from "effect";
import { Ref } from "effect";
import type { TranscriptEntry } from "../transcript/transcript";
import type { SessionState } from "./state";

export const appendEntry = (
  state: SessionState,
  entry: TranscriptEntry,
): Effect.Effect<void> =>
  Ref.update(state.entries, (entries) => [...entries, entry]);
