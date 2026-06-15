import { Effect, Ref, Stream } from "effect";
import { LanguageModel, Response } from "effect/unstable/ai";

export type ScriptedTurn = ReadonlyArray<Response.StreamPartEncoded>;

const usage = (): Response.Usage =>
  new Response.Usage({
    inputTokens: {
      cacheRead: undefined,
      cacheWrite: undefined,
      total: undefined,
      uncached: undefined,
    },
    outputTokens: {
      reasoning: undefined,
      text: undefined,
      total: undefined,
    },
  });

export const finish = (reason: Response.FinishReason): Response.FinishPart =>
  Response.makePart("finish", {
    reason,
    response: undefined,
    usage: usage(),
  });

export const text = (id: string, value: string): ScriptedTurn => [
  Response.makePart("text-start", { id }),
  Response.makePart("text-delta", { delta: value, id }),
  Response.makePart("text-end", { id }),
];

export const scriptedModel = (
  turns: ReadonlyArray<ScriptedTurn>,
): Effect.Effect<LanguageModel.Service> =>
  Effect.gen(function* () {
    const index = yield* Ref.make(0);
    return yield* LanguageModel.make({
      generateText: () => Effect.succeed([]),
      streamText: () =>
        Stream.unwrap(
          Ref.getAndUpdate(index, (value) => value + 1).pipe(
            Effect.map((value) => Stream.fromIterable(turns[value] ?? [])),
          ),
        ),
    });
  });
