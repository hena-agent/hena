import { Effect } from "effect";
import type { CoreServices } from "../services/services";
import type { UserEntry } from "../transcript/transcript";
import { appendEntry } from "./append-entry";
import { emit } from "./emit";
import { nextEntryId } from "./next-entry-id";
import { now } from "./now";
import type { SessionState } from "./state";

export const appendPrompt = (
  state: SessionState,
  content: string,
): Effect.Effect<UserEntry, never, CoreServices> =>
  Effect.gen(function* () {
    const entry: UserEntry = {
      content,
      id: yield* nextEntryId(state),
      role: "user",
      source: "prompt",
      timestamp: now(),
    };
    yield* appendEntry(state, entry);
    yield* emit(state, { entry, type: "user_message" });
    return entry;
  });
