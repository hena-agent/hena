import { Effect, Path as EffectPath, FileSystem } from "effect";
import type { PlatformError } from "effect/PlatformError";

import { candidatePaths } from "./projectInstructionPaths";
import type { ProjectInstruction } from "./systemPrompt";

export interface ProjectInstructionDiscoveryInput {
  readonly cwd: string;
  readonly roots: ReadonlyArray<string>;
  readonly targetDirectory?: string;
}

const readIfPresent = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(path);
  if (!exists) {
    return undefined;
  }

  return {
    path,
    content: yield* fs.readFileString(path),
  } satisfies ProjectInstruction;
});

export const collectProjectInstructions: (
  input: ProjectInstructionDiscoveryInput,
) => Effect.Effect<
  ReadonlyArray<ProjectInstruction>,
  PlatformError,
  FileSystem.FileSystem | EffectPath.Path
> = Effect.fnUntraced(function* (input) {
  const pathService = yield* EffectPath.Path;
  const instructions = yield* Effect.forEach(
    candidatePaths(pathService, input),
    readIfPresent,
  );

  return instructions.filter(
    (item): item is ProjectInstruction => item !== undefined,
  );
});
