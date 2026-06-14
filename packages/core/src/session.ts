import { Context, Fiber } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import type { CoreEvent } from "./events";
import { runPromptLoop } from "./loop";
import { type CoreServices, EventBus } from "./services";
import { makeSessionState, transcriptSnapshot } from "./state";
import type { TranscriptEntry } from "./transcript";

export type Session = {
  readonly abort: () => void;
  readonly dispose: () => Promise<void>;
  /** Each new iteration replays this session's buffered events until disposed. */
  readonly events: AsyncIterable<CoreEvent>;
  readonly id: string;
  readonly prompt: (input: string) => Promise<void>;
  readonly transcript: () => readonly TranscriptEntry[];
};

type ActiveRun = {
  readonly controller: AbortController;
  readonly fiber: Fiber.Fiber<void>;
};

type MakeSessionOptions = {
  readonly context: Context.Context<CoreServices>;
  readonly id: string;
  readonly maxTurns: number;
  readonly onDispose: () => void;
  readonly runtime: ManagedRuntime<CoreServices, never>;
};

const DISPOSE_ABORT_GRACE_MS = 10;

export function makeSession(options: MakeSessionOptions): Session {
  const { context, id, maxTurns, onDispose, runtime } = options;
  const state = runtime.runSync(makeSessionState(id));
  const bus = Context.get(context, EventBus);
  bus.register(id);
  const events = bus.stream(id);
  let active: ActiveRun | undefined;
  let disposed = false;
  const promptInput = async (input: string): Promise<void> => {
    if (disposed) {
      throw new Error("Session is disposed");
    }
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
  const dispose = async (): Promise<void> => {
    if (disposed) {
      return;
    }
    disposed = true;
    const running = active;
    active = undefined;
    running?.controller.abort();
    if (running !== undefined) {
      const settled = await waitForActiveRun(runtime, running);
      if (!settled) {
        runtime.runFork(Fiber.interrupt(running.fiber));
      }
    }
    bus.unregister(id);
    onDispose();
  };
  return {
    abort: () => active?.controller.abort(),
    dispose,
    events,
    id,
    prompt: promptInput,
    transcript: () => runtime.runSync(transcriptSnapshot(state)),
  };
}

async function waitForActiveRun(
  runtime: ManagedRuntime<CoreServices, never>,
  active: ActiveRun,
): Promise<boolean> {
  const joined = runtime.runPromise(Fiber.join(active.fiber)).then(
    () => true,
    () => true,
  );
  const settled = await Promise.race([joined, delay(DISPOSE_ABORT_GRACE_MS)]);
  return settled;
}

async function delay(ms: number): Promise<false> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
  return false;
}
