import { Effect, type Path as EffectPath, Option } from "effect";
import { type PlatformError, systemError } from "effect/PlatformError";

const maxSymlinkDepth = 40;

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
  path: string,
) {
  const target = yield* Effect.option(input.readLink(path));
  if (Option.isNone(target)) {
    return Option.none<string>();
  }
  if (input.pathService.isAbsolute(target.value)) {
    return Option.some(target.value);
  }
  return Option.some(
    input.pathService.resolve(input.pathService.dirname(path), target.value),
  );
});

const resolveMissingTarget: (
  input: ResolveWriteTargetInput,
  path: string,
  depth: number,
) => Effect.Effect<string, PlatformError> = Effect.fnUntraced(
  function* (input, path, depth) {
    if (depth >= maxSymlinkDepth) {
      return yield* Effect.fail(
        systemError({
          _tag: "InvalidData",
          module: "FileSystem",
          method: "readLink",
          pathOrDescriptor: path,
        }),
      );
    }

    const target = yield* resolveSymlinkTarget(input, path);
    if (Option.isNone(target)) {
      return yield* resolveCreateTarget({ ...input, path });
    }
    const exists = yield* input.pathExists(target.value);
    if (exists) {
      return yield* input.canonicalize(target.value);
    }
    return yield* resolveMissingTarget(input, target.value, depth + 1);
  },
);

export const resolveWriteTarget = Effect.fnUntraced(function* (
  input: ResolveWriteTargetInput,
) {
  const exists = yield* input.pathExists(input.path);
  if (exists) {
    return yield* input.canonicalize(input.path);
  }
  return yield* resolveMissingTarget(input, input.path, 0);
});
