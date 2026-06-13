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
  return {
    createSession: () => makeSession(managed, context, maxTurns),
    dispose: async (): Promise<void> => {
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
