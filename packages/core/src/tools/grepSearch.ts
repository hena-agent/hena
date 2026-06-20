import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Path as EffectPath, type FileSystem } from "effect";
import type {
  FileSearchAuthorize,
  FileSearchCandidate,
} from "./fileSearchTypes";
import { searchFiles } from "./files";
import { formatMatches, grepFiles, makeIncludeMatcher } from "./grepOperations";

export interface GrepSearchParameters {
  readonly include?: string | undefined;
  readonly pattern: string;
}

interface GrepSearchDetails {
  readonly matches: number;
  readonly truncated: boolean;
}

export interface GrepSearchInput {
  readonly authorize?: FileSearchAuthorize | undefined;
  readonly fs: FileSystem.FileSystem;
  readonly params: GrepSearchParameters;
  readonly pathService: EffectPath.Path;
  readonly root: string;
}

const maxGrepFiles = 10000;
const maxGrepMatches = 1000;

export const executeGrepSearch = Effect.fnUntraced(function* (
  input: GrepSearchInput,
) {
  const { authorize, fs, params, pathService, root } = input;
  const pattern = new RegExp(params.pattern);
  const matchesInclude = makeIncludeMatcher(params.include);
  const candidates = yield* searchFiles(fs, pathService, root, {
    authorize,
    limit: maxGrepFiles,
    matches: (candidate: FileSearchCandidate) =>
      matchesInclude(
        candidate.relativePath,
        pathService.basename(candidate.path),
      ),
  });
  const result = yield* grepFiles(
    fs,
    pattern,
    candidates.files,
    maxGrepMatches,
  );
  const truncated = candidates.truncated || result.truncated;

  return {
    content: [
      {
        type: "text",
        text: formatMatches(result.matches) || "No files found",
      },
    ],
    details: { matches: result.matches.length, truncated },
  } satisfies PiAgent.AgentToolResult<GrepSearchDetails>;
});
