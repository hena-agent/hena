import type { FileSearchOptions, FileSearchResult } from "./fileSearchTypes";

export interface FileSearchCollector {
  readonly truncated: boolean;
  readonly add: (path: string) => void;
  readonly matches: (path: string, relativePath: string) => boolean;
  readonly result: () => FileSearchResult;
}

const normalizePath = (path: string): string => path.replaceAll("\\", "/");

export const makeFileSearchCollector = (
  options: FileSearchOptions,
): FileSearchCollector => {
  const files: Array<string> = [];
  let truncated = false;

  return {
    get truncated(): boolean {
      return truncated;
    },
    add: (path: string): void => {
      if (files.length >= options.limit) {
        truncated = true;
        return;
      }
      files.push(path);
    },
    matches: (path: string, relativePath: string): boolean =>
      options.matches({ path, relativePath: normalizePath(relativePath) }),
    result: (): FileSearchResult => ({ files, truncated }),
  };
};
