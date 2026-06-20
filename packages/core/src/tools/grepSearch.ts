import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Path as EffectPath, type FileSystem } from "effect";
import type {
  FileSearchAuthorize,
  FileSearchCandidate,
} from "./fileSearchTypes";
import { searchFiles } from "./files";
import { formatMatches } from "./grepFormat";
import { grepFiles, makeIncludeMatcher } from "./grepOperations";
import { ToolInputError } from "./toolErrors";

interface GrepSearchParameters {
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

const compilePattern = (
  pattern: string,
): Effect.Effect<RegExp, ToolInputError> =>
  Effect.try({
    try: () => new RegExp(pattern),
    catch: (error: unknown) =>
      new ToolInputError({
        message: String(error),
      }),
  });

export const executeGrepSearch = Effect.fnUntraced(function* (
  input: GrepSearchInput,
) {
  const { authorize, fs, params, pathService, root } = input;
  const pattern = yield* compilePattern(params.pattern);
  const matchesInclude = yield* makeIncludeMatcher(params.include);
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
  const output = formatMatches(result.matches);
  const truncated =
    candidates.truncated || result.truncated || output.truncated;

  return {
    content: [
      {
        type: "text",
        text: output.text || "No files found",
      },
    ],
    details: { matches: result.matches.length, truncated },
  } satisfies PiAgent.AgentToolResult<GrepSearchDetails>;
});
