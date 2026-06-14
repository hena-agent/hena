import { Effect, Ref } from "effect";
import type { CoreEvent, EventPayload } from "./events";
import { type CoreServices, EventBus } from "./services";
import type { TranscriptEntry, UserEntry } from "./transcript";

export type SessionState = {
  readonly entries: Ref.Ref<readonly TranscriptEntry[]>;
  readonly entryCounter: Ref.Ref<number>;
  readonly id: string;
  readonly sequence: Ref.Ref<number>;
};

export function makeSessionState(id: string): Effect.Effect<SessionState> {
  return Effect.gen(function* () {
    const entries = yield* Ref.make<readonly TranscriptEntry[]>([]);
    const entryCounter = yield* Ref.make(1);
    const sequence = yield* Ref.make(1);
    return { entries, entryCounter, id, sequence };
  });
}

export function transcriptSnapshot(
  state: SessionState,
): Effect.Effect<readonly TranscriptEntry[]> {
  return Ref.get(state.entries);
}

export function appendEntry(
  state: SessionState,
  entry: TranscriptEntry,
): Effect.Effect<void> {
  return Ref.update(state.entries, (entries) => [...entries, entry]);
}

export function appendPrompt(
  state: SessionState,
  content: string,
): Effect.Effect<UserEntry, never, CoreServices> {
  return Effect.gen(function* () {
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
}

export function nextEntryId(state: SessionState): Effect.Effect<string> {
  return Effect.map(
    Ref.getAndUpdate(state.entryCounter, (current) => current + 1),
    (value) => `entry_${value}`,
  );
}

export function emit(
  state: SessionState,
  payload: EventPayload,
): Effect.Effect<CoreEvent, never, CoreServices> {
  return Effect.gen(function* () {
    const bus = yield* EventBus;
    const sequence = yield* Ref.getAndUpdate(
      state.sequence,
      (value) => value + 1,
    );
    const event: CoreEvent = {
      ...payload,
      schemaVersion: 1 as const,
      sequence,
      sessionId: state.id,
      timestamp: now(),
    };
    bus.publish(event);
    return event;
  });
}

export function now(): string {
  return new Date().toISOString();
}
