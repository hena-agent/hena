import { Effect } from "effect";

import { ToolInputError } from "./toolErrors";

export interface GlobMatcherRuntime {
  readonly compile: (glob: string) => {
    readonly match: (path: string) => boolean;
  };
}

const BunGlobMatcherRuntime: GlobMatcherRuntime = {
  compile: (glob: string) => new Bun.Glob(glob),
};

const compileGlob = (
  glob: string,
  runtime: GlobMatcherRuntime = BunGlobMatcherRuntime,
): ((path: string) => boolean) => {
  const pattern = runtime.compile(glob);
  return (path: string): boolean => pattern.match(path.replaceAll("\\", "/"));
};

export const matchesGlob = (glob: string, path: string): boolean =>
  compileGlob(glob)(path);

export const compileGlobEffect = (
  glob: string,
  runtime: GlobMatcherRuntime = BunGlobMatcherRuntime,
): Effect.Effect<(path: string) => boolean, ToolInputError> =>
  Effect.try({
    try: () => compileGlob(glob, runtime),
    catch: (error: unknown) =>
      new ToolInputError({ message: String(error).replace(/^Error: /, "") }),
  });
