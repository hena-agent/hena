import { Effect, Path as EffectPath, FileSystem } from "effect";

import { isInsideRoot } from "../path/helpers";
import type { ProjectInstruction } from "./systemPrompt";

export interface ProjectInstructionDiscoveryInput {
  readonly cwd: string;
  readonly roots: ReadonlyArray<string>;
  readonly targetDirectory?: string;
}

const instructionFilenames = ["AGENTS.md", "CLAUDE.md"] as const;

const resolveDirectory = (
  pathService: EffectPath.Path,
  cwd: string,
  directory: string,
): string =>
  pathService.isAbsolute(directory)
    ? pathService.normalize(directory)
    : pathService.resolve(cwd, directory);

const directoriesFromRoot = (
  pathService: EffectPath.Path,
  root: string,
  target: string,
): ReadonlyArray<string> => {
  if (!isInsideRoot(pathService, root, target)) {
    return [];
  }

  const directories: Array<string> = [];
  let current = target;

  while (current !== root) {
    directories.push(current);
    current = pathService.dirname(current);
  }

  directories.push(root);
  return directories.reverse();
};

const candidatePaths = (
  pathService: EffectPath.Path,
  input: ProjectInstructionDiscoveryInput,
): ReadonlyArray<string> => {
  const target = resolveDirectory(
    pathService,
    input.cwd,
    input.targetDirectory ?? input.cwd,
  );
  const roots = input.roots.length === 0 ? [input.cwd] : input.roots;

  return roots.flatMap((root) =>
    directoriesFromRoot(
      pathService,
      resolveDirectory(pathService, input.cwd, root),
      target,
    ).flatMap((directory) =>
      instructionFilenames.map((filename) =>
        pathService.join(directory, filename),
      ),
    ),
  );
};

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
  unknown,
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
