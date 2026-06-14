import { ManagedRuntime } from "effect";
import { collectExtensions } from "../extensions/collect-extensions";
import { makeCoreLayer } from "../services/make-core-layer";
import type { CoreServices } from "../services/services";
import { makeSession } from "../session/make-session";
import type { Session } from "../session/session";
import { disposeRuntime } from "./dispose-runtime";
import { normalizeMaxTurns } from "./normalize-max-turns";
import type { CreateRuntimeOptions, HenaRuntime } from "./runtime";

export const createRuntime = async (
  options: CreateRuntimeOptions,
): Promise<HenaRuntime> => {
  const maxTurns = normalizeMaxTurns(options.maxTurns);
  const collected = await collectExtensions(options.extensions);
  if (collected.provider === undefined) {
    throw new Error("A provider extension is required");
  }
  const managed = ManagedRuntime.make<CoreServices, never>(
    makeCoreLayer(collected.provider, collected.tools, collected.observers),
  );
  const context = await managed.context();
  const sessions = new Map<string, Session>();
  let sessionCounter = 1;
  let disposed = false;
  let disposal: Promise<void> | undefined;
  return {
    createSession: () => {
      if (disposed) {
        throw new Error("Runtime is disposed");
      }
      const id = `session_${sessionCounter}`;
      sessionCounter += 1;
      const session = makeSession({
        context,
        id,
        maxTurns,
        onDispose: () => {
          sessions.delete(id);
        },
        runtime: managed,
      });
      sessions.set(id, session);
      return session;
    },
    dispose: async (): Promise<void> => {
      if (disposal !== undefined) {
        await disposal;
        return;
      }
      disposed = true;
      disposal = disposeRuntime(sessions, managed);
      await disposal;
    },
  };
};
