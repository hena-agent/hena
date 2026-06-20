import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Path as EffectPath, type FileSystem } from "effect";
import type {
  FileSearchAuthorize,
  FileSearchCandidate,
} from "./fileSearchTypes";
import { searchFiles } from "./files";
import { compileGlob } from "./globMatch";

interface GlobSearchParameters {
  readonly pattern: string;
}

interface GlobSearchDetails {
  readonly count: number;
  readonly truncated: boolean;
}

export interface GlobSearchInput {
  readonly authorize?: FileSearchAuthorize | undefined;
  readonly fs: FileSystem.FileSystem;
  readonly params: GlobSearchParameters;
  readonly pathService: EffectPath.Path;
  readonly root: string;
}

const maxGlobMatches = 1000;

export const executeGlobSearch = Effect.fnUntraced(function* (
  input: GlobSearchInput,
) {
  const { authorize, fs, params, pathService, root } = input;
  const matchesPattern = compileGlob(params.pattern);
  const matches = yield* searchFiles(fs, pathService, root, {
    authorize,
    limit: maxGlobMatches,
    matches: (candidate: FileSearchCandidate) =>
      matchesPattern(candidate.relativePath),
  });

  return {
    content: [
      { type: "text", text: matches.files.join("\n") || "No files found" },
    ],
    details: { count: matches.files.length, truncated: matches.truncated },
  } satisfies PiAgent.AgentToolResult<GlobSearchDetails>;
});
