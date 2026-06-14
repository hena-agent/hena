import { Context, Fiber } from "effect";
import { runPromptLoop } from "../loop/run-prompt-loop";
import { EventBus } from "../services/services";
import { makeSessionState } from "../state/make-session-state";
import { transcriptSnapshot } from "../state/transcript-snapshot";
import type { ActiveRun, MakeSessionOptions, Session } from "./session";
import { waitForActiveRun } from "./wait-for-active-run";

export const makeSession = (options: MakeSessionOptions): Session => {
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
};
