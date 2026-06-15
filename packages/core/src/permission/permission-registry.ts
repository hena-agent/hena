import { Effect, type Scope } from "effect";
import type { Response } from "effect/unstable/ai";

import { makeScopedRegistry } from "../registry/scoped-registry";

type PermissionDecision =
  | { readonly status: "allow" }
  | { readonly reason: string; readonly status: "deny" };

export type PermissionCheck = (
  call: Response.ToolCallPart<string, unknown>,
) => Effect.Effect<PermissionDecision>;

export interface PermissionRegistry {
  readonly check: (
    call: Response.ToolCallPart<string, unknown>,
  ) => Effect.Effect<PermissionDecision>;
  readonly register: (
    check: PermissionCheck,
  ) => Effect.Effect<void, never, Scope.Scope>;
}

export const makePermissionRegistry = Effect.fnUntraced(function* () {
  const registry = yield* makeScopedRegistry<PermissionCheck>();

  const check = Effect.fnUntraced(function* (
    call: Response.ToolCallPart<string, unknown>,
  ) {
    for (const rule of yield* registry.values) {
      const decision = yield* rule(call);
      if (decision.status === "deny") return decision;
    }
    return { status: "allow" } as const;
  });

  return { check, register: registry.register } satisfies PermissionRegistry;
});
