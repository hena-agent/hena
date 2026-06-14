import { Effect } from "effect";
import { closeProviderIterator } from "../provider/close-provider-iterator";
import type { CoreServices } from "../services/services";
import type { SessionState } from "../state/state";
import { applyChunk } from "./apply-chunk";
import { emptyAccumulator } from "./empty-accumulator";
import { openIterator } from "./open-iterator";
import { readNext } from "./read-next";
import type { ProviderStreamFactory, TurnAccumulator } from "./turn-stream";

export const consumeProviderStream = (
  state: SessionState,
  stream: ProviderStreamFactory,
  signal: AbortSignal,
): Effect.Effect<TurnAccumulator, never, CoreServices> =>
  Effect.gen(function* () {
    const iterator = yield* openIterator(stream, signal);
    const accumulator = emptyAccumulator();
    return yield* Effect.gen(function* () {
      let reading = true;
      while (reading) {
        const chunk = yield* readNext(iterator, signal);
        yield* applyChunk(state, accumulator, chunk);
        reading = chunk.type !== "finish";
      }
      return accumulator;
    }).pipe(Effect.ensuring(closeProviderIterator(iterator, signal)));
  });
