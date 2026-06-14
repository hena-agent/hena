import { Effect, Ref } from "effect";
import type { SessionState } from "./state";

export const nextEntryId = (state: SessionState): Effect.Effect<string> =>
  Effect.map(
    Ref.getAndUpdate(state.entryCounter, (current) => current + 1),
    (value) => `entry_${value}`,
  );
