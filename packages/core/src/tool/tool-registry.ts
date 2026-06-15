import { Effect, Option, type Scope } from "effect";
import type { Tool } from "effect/unstable/ai";

import { makeScopedRegistry } from "../registry/scoped-registry";

export type ToolHandler = (params: unknown) => Effect.Effect<unknown, unknown>;

export interface ToolEntry {
  readonly handler: ToolHandler;
  readonly name: string;
  readonly tool: Tool.Any;
}

export interface ToolRegistry {
  readonly entries: Effect.Effect<ReadonlyArray<ToolEntry>>;
  readonly find: (name: string) => Effect.Effect<Option.Option<ToolEntry>>;
  readonly register: (
    name: string,
    tool: Tool.Any,
    handler: ToolHandler,
  ) => Effect.Effect<void, never, Scope.Scope>;
}

export const makeToolRegistry = Effect.fnUntraced(function* () {
  const registry = yield* makeScopedRegistry<ToolEntry>();

  return {
    entries: registry.values,
    find: (name: string) =>
      registry.values.pipe(
        Effect.map((entries) =>
          Option.fromUndefinedOr(entries.find((entry) => entry.name === name)),
        ),
      ),
    register: (name: string, tool: Tool.Any, handler: ToolHandler) =>
      registry.register({ handler, name, tool }),
  } satisfies ToolRegistry;
});
