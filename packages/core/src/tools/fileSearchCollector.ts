import type { FileSearchOptions, FileSearchResult } from "./fileSearchTypes";

export interface FileSearchCollector {
  readonly full: boolean;
  readonly truncated: boolean;
  readonly add: (path: string) => void;
  readonly markTruncated: () => void;
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
    get full(): boolean {
      return files.length >= options.limit;
    },
    add: (path: string): void => {
      if (files.length >= options.limit) {
        truncated = true;
        return;
      }
      files.push(path);
    },
    markTruncated: (): void => {
      truncated = true;
    },
    matches: (path: string, relativePath: string): boolean =>
      options.matches({ path, relativePath: normalizePath(relativePath) }),
    result: (): FileSearchResult => ({ files, truncated }),
  };
};
