import { ManagedRuntime } from "effect";
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
  const sessions = new Set<Session>();
  let sessionCounter = 1;
  return {
    createSession: () => {
      const id = `session_${sessionCounter}`;
      sessionCounter += 1;
      let session: Session;
      session = makeSession({
        context,
        id,
        maxTurns,
        onDispose: () => {
          sessions.delete(session);
        },
        runtime: managed,
      });
      sessions.add(session);
      return session;
    },
    dispose: async (): Promise<void> => {
      await Promise.all(
        Array.from(sessions, async (session) => {
          await session.dispose();
        }),
      );
      await managed.dispose();
    },
  };
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
