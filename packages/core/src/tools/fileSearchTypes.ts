import type { Effect } from "effect";

import type { ToolExecutionError } from "./schema";

export interface FileSearchCandidate {
  readonly path: string;
  readonly relativePath: string;
}

export type FileSearchTargetKind = "directory" | "file";

export type FileSearchAuthorize = (
  path: string,
  kind: FileSearchTargetKind,
) => Effect.Effect<{ readonly canonicalPath: string }, ToolExecutionError>;

export interface FileSearchOptions {
  readonly authorize?: FileSearchAuthorize | undefined;
  readonly limit: number;
  readonly matches: (candidate: FileSearchCandidate) => boolean;
}

export interface FileSearchResult {
  readonly files: ReadonlyArray<string>;
  readonly truncated: boolean;
}
