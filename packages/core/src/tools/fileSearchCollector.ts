import type { FileSearchOptions, FileSearchResult } from "./fileSearchTypes";

export interface FileSearchCollector {
  readonly truncated: boolean;
  readonly add: (path: string, relativePath: string) => void;
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
    add: (path: string, relativePath: string): void => {
      if (
        !options.matches({ path, relativePath: normalizePath(relativePath) })
      ) {
        return;
      }
      if (files.length >= options.limit) {
        truncated = true;
        return;
      }
      files.push(path);
    },
    result: (): FileSearchResult => ({ files, truncated }),
  };
};
