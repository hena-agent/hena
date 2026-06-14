import { ManagedRuntime } from "effect";
import type { ManagedRuntime as ManagedRuntimeType } from "effect/ManagedRuntime";
import { collectExtensions, type Extension } from "./extension";
import { type CoreServices, makeCoreLayer } from "./services";
import { makeSession, type Session } from "./session";

export type CreateRuntimeOptions = {
  readonly extensions: readonly Extension[];
  readonly maxTurns?: number;
};

export type HenaRuntime = {
  readonly createSession: () => Session;
  readonly dispose: () => Promise<void>;
};

export async function createRuntime(
  options: CreateRuntimeOptions,
): Promise<HenaRuntime> {
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
}

async function disposeRuntime(
  sessions: Map<string, Session>,
  managed: ManagedRuntimeType<CoreServices, never>,
): Promise<void> {
  await Promise.all(
    Array.from(sessions.values(), async (session) => {
      await session.dispose();
    }),
  );
  await managed.dispose();
}

function normalizeMaxTurns(value: number | undefined): number {
  if (value === undefined) {
    return 64;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("maxTurns must be a positive integer");
  }
  return value;
}
