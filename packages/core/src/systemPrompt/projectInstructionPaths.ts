import type { Path as EffectPath } from "effect";

import { isInsideRoot } from "../path/helpers";
import type { ProjectInstructionDiscoveryInput } from "./projectInstructions";

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
  const directories: Array<string> = [];
  let current = target;

  while (current !== root) {
    directories.push(current);
    current = pathService.dirname(current);
  }

  directories.push(root);
  return directories.reverse();
};

export const candidatePaths = (
  pathService: EffectPath.Path,
  input: ProjectInstructionDiscoveryInput,
): ReadonlyArray<string> => {
  const target = resolveDirectory(
    pathService,
    input.cwd,
    input.targetDirectory ?? input.cwd,
  );
  const roots = (input.roots.length === 0 ? [input.cwd] : input.roots)
    .map((root) => resolveDirectory(pathService, input.cwd, root))
    .filter((root) => isInsideRoot(pathService, root, target))
    .sort((left, right) => left.length - right.length);
  const seen = new Set<string>();

  return roots
    .flatMap((root) =>
      directoriesFromRoot(pathService, root, target).flatMap((directory) =>
        instructionFilenames.map((filename) =>
          pathService.normalize(pathService.join(directory, filename)),
        ),
      ),
    )
    .filter((path) => {
      if (seen.has(path)) {
        return false;
      }
      seen.add(path);
      return true;
    });
};
