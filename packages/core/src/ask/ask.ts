import { Deferred, Effect, Ref } from "effect";

import type { EventBus } from "../event/event";

export interface AskRequest {
  readonly prompt: string;
}

interface PendingAsk extends AskRequest {
  readonly id: string;
}

export interface AskReply {
  readonly answer: string;
  readonly id: string;
}

interface PendingEntry extends PendingAsk {
  readonly deferred: Deferred.Deferred<string>;
}

export interface AskService {
  readonly ask: (request: AskRequest) => Effect.Effect<string>;
  readonly pending: Effect.Effect<ReadonlyArray<PendingAsk>>;
  readonly reply: (reply: AskReply) => Effect.Effect<void>;
}

export const makeAskService = Effect.fnUntraced(function* (events: EventBus) {
  const nextId = yield* Ref.make(0);
  const pending = yield* Ref.make<ReadonlyMap<string, PendingEntry>>(new Map());

  return {
    ask: (request: AskRequest) =>
      Effect.gen(function* () {
        const deferred = yield* Deferred.make<string>();
        const id = `ask_${yield* Ref.getAndUpdate(nextId, (value) => value + 1)}`;
        const entry = { ...request, deferred, id };
        yield* Ref.update(pending, (items) => new Map(items).set(id, entry));
        yield* events.publish({
          id,
          prompt: request.prompt,
          type: "ask.requested",
        });
        return yield* Deferred.await(deferred);
      }),
    pending: Ref.get(pending).pipe(
      Effect.map((items) =>
        Array.from(items.values()).map(({ id, prompt }) => ({ id, prompt })),
      ),
    ),
    reply: (reply: AskReply) =>
      Effect.gen(function* () {
        const entry = yield* Ref.get(pending).pipe(
          Effect.map((items) => items.get(reply.id)),
        );
        if (entry === undefined) return;
        yield* Ref.update(pending, (items) => {
          const updated = new Map(items);
          updated.delete(reply.id);
          return updated;
        });
        yield* events.publish({ ...reply, type: "ask.replied" });
        yield* Deferred.succeed(entry.deferred, reply.answer);
      }),
  } satisfies AskService;
});
