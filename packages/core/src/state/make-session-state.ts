import { Effect, Ref } from "effect";
import type { TranscriptEntry } from "../transcript/transcript";
import type { SessionState } from "./state";

export const makeSessionState = (id: string): Effect.Effect<SessionState> =>
  Effect.gen(function* () {
    const entries = yield* Ref.make<readonly TranscriptEntry[]>([]);
    const entryCounter = yield* Ref.make(1);
    const sequence = yield* Ref.make(1);
    return { entries, entryCounter, id, sequence };
  });
