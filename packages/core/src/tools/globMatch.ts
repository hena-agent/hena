export interface GlobMatcherRuntime {
  readonly compile: (glob: string) => {
    readonly match: (path: string) => boolean;
  };
}

const BunGlobMatcherRuntime: GlobMatcherRuntime = {
  compile: (glob: string) => new Bun.Glob(glob),
};

export const compileGlob = (
  glob: string,
  runtime: GlobMatcherRuntime = BunGlobMatcherRuntime,
): ((path: string) => boolean) => {
  const pattern = runtime.compile(glob);
  return (path: string): boolean => pattern.match(path.replaceAll("\\", "/"));
};

export const matchesGlob = (glob: string, path: string): boolean =>
  compileGlob(glob)(path);
