export const compileGlob = (glob: string): ((path: string) => boolean) => {
  const pattern = new Bun.Glob(glob);
  return (path: string): boolean => pattern.match(path.replaceAll("\\", "/"));
};

export const matchesGlob = (glob: string, path: string): boolean =>
  compileGlob(glob)(path);
