import { Effect, type Path as EffectPath, Option } from "effect";
import type { PlatformError } from "effect/PlatformError";

interface ResolveWriteTargetInput {
  readonly canonicalize: (path: string) => Effect.Effect<string, PlatformError>;
  readonly path: string;
  readonly pathExists: (path: string) => Effect.Effect<boolean, PlatformError>;
  readonly pathService: EffectPath.Path;
  readonly readLink: (path: string) => Effect.Effect<string, PlatformError>;
}

const resolveCreateTarget = Effect.fnUntraced(function* (
  input: ResolveWriteTargetInput,
) {
  const parent = yield* input.canonicalize(
    input.pathService.dirname(input.path),
  );
  return input.pathService.join(parent, input.pathService.basename(input.path));
});

const resolveSymlinkTarget = Effect.fnUntraced(function* (
  input: ResolveWriteTargetInput,
) {
  const target = yield* Effect.option(input.readLink(input.path));
  if (Option.isNone(target)) {
    return Option.none<string>();
  }
  if (input.pathService.isAbsolute(target.value)) {
    return Option.some(target.value);
  }
  return Option.some(
    input.pathService.resolve(
      input.pathService.dirname(input.path),
      target.value,
    ),
  );
});

export const resolveWriteTarget = Effect.fnUntraced(function* (
  input: ResolveWriteTargetInput,
) {
  const exists = yield* input.pathExists(input.path);
  if (exists) {
    return yield* input.canonicalize(input.path);
  }
  const target = yield* resolveSymlinkTarget(input);
  if (Option.isSome(target)) {
    return yield* resolveCreateTarget({ ...input, path: target.value });
  }
  return yield* resolveCreateTarget(input);
});
