import { Context, Fiber, Stream } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import type { CoreEvent } from "./events";
import { nextSessionId } from "./ids";
import { runPromptLoop } from "./loop";
import { type CoreServices, EventBus } from "./services";
import { makeSessionState, transcriptSnapshot } from "./state";
import type { TranscriptEntry } from "./transcript";

export type Session = {
  readonly abort: () => void;
  /** Each new iteration replays this session's buffered events. */
  readonly events: AsyncIterable<CoreEvent>;
  readonly id: string;
  readonly prompt: (input: string) => Promise<void>;
  readonly transcript: () => readonly TranscriptEntry[];
};

type ActiveRun = {
  readonly controller: AbortController;
  readonly fiber: Fiber.Fiber<void>;
};

export function makeSession(
  runtime: ManagedRuntime<CoreServices, never>,
  context: Context.Context<CoreServices>,
  maxTurns: number,
): Session {
  const id = nextSessionId();
  const state = runtime.runSync(makeSessionState(id));
  const bus = Context.get(context, EventBus);
  const events = Stream.toAsyncIterableWith(
    runtime.runSync(bus.stream(id)),
    context,
  );
  let active: ActiveRun | undefined;
  const promptInput = async (input: string): Promise<void> => {
    if (active !== undefined) {
      throw new Error("Session already has an active run");
    }
    const controller = new AbortController();
    const fiber = runtime.runFork(
      runPromptLoop(state, input, controller.signal, maxTurns),
    );
    active = { controller, fiber };
    try {
      await runtime.runPromise(Fiber.join(fiber));
    } finally {
      active = undefined;
    }
  };
  return {
    abort: () => active?.controller.abort(),
    events,
    id,
    prompt: promptInput,
    transcript: () => runtime.runSync(transcriptSnapshot(state)),
  };
}
