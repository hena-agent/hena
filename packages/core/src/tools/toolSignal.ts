import { Effect } from "effect";

const interruptOnAbort = (signal: AbortSignal): Effect.Effect<never> => {
  if (signal.aborted) {
    return Effect.interrupt;
  }
  return Effect.callback<never>((resume) => {
    const onAbort = (): void => {
      resume(Effect.interrupt);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    return Effect.sync(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
};

export const raceAbortSignal = <A, E, R>(
  effect: Effect.Effect<A, E, R>,
  signal: AbortSignal | undefined,
): Effect.Effect<A, E, R> =>
  signal === undefined
    ? effect
    : Effect.raceFirst(effect, interruptOnAbort(signal));
