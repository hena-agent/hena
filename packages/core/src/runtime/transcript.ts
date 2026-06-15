import { type Effect, Ref } from "effect";

import type { Entry } from "./entry";

export const appendEntry = (
  entries: Ref.Ref<ReadonlyArray<Entry>>,
  entry: Entry,
): Effect.Effect<void> => Ref.update(entries, (current) => [...current, entry]);
