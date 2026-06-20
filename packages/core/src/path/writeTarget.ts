import { Effect, type Path as EffectPath } from "effect";
import type { PlatformError } from "effect/PlatformError";

interface ResolveWriteTargetInput {
  readonly canonicalize: (path: string) => Effect.Effect<string, PlatformError>;
  readonly path: string;
  readonly pathExists: (path: string) => Effect.Effect<boolean, PlatformError>;
  readonly pathService: EffectPath.Path;
}

const resolveCreateTarget = Effect.fnUntraced(function* (
  input: ResolveWriteTargetInput,
) {
  const parent = yield* input.canonicalize(
    input.pathService.dirname(input.path),
  );
  return input.pathService.join(parent, input.pathService.basename(input.path));
});

export const resolveWriteTarget = Effect.fnUntraced(function* (
  input: ResolveWriteTargetInput,
) {
  const exists = yield* input.pathExists(input.path);
  if (exists) {
    return yield* input.canonicalize(input.path);
  }
  return yield* resolveCreateTarget(input);
});
