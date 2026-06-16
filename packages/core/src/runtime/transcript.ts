import { type Effect, Ref } from "effect";
import type { Prompt } from "effect/unstable/ai";

export const appendEntry = (
  entries: Ref.Ref<ReadonlyArray<Prompt.Message>>,
  entry: Prompt.Message,
): Effect.Effect<void> => Ref.update(entries, (current) => [...current, entry]);
