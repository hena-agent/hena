import type { Path as EffectPath } from "effect";

type TargetKind = "file" | "directory";

export interface ExternalDirectoryPattern {
  readonly parentDir: string;
  readonly pattern: string;
}

export const isInsideRoot = (
  pathService: EffectPath.Path,
  root: string,
  target: string,
): boolean => {
  const relative = pathService.relative(root, target);
  return !(relative === ".." || relative.startsWith("../"));
};

export const externalDirectoryPattern = (
  pathService: EffectPath.Path,
  canonicalPath: string,
  kind: TargetKind,
): ExternalDirectoryPattern => {
  const parentDir =
    kind === "directory" ? canonicalPath : pathService.dirname(canonicalPath);
  return {
    parentDir,
    pattern: pathService.join(parentDir, "*").replaceAll("\\", "/"),
  };
};
