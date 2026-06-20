import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Path as EffectPath, type FileSystem } from "effect";

import type { ReadToolParameters } from "./ReadTool";
import type { ReadToolDetails } from "./readDetails";
import { readLineWindow } from "./readLineWindow";

export const readFile = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
  params: ReadToolParameters,
) {
  const lineStart = params.offset ?? 1;
  const limit = params.limit ?? 2000;
  const window = yield* readLineWindow(fs, path, lineStart, limit);
  const body = window.lines
    .map((line, index) => `${lineStart + index}: ${line}`)
    .join("\n");
  return {
    content: [{ type: "text", text: body }],
    details: {
      path,
      type: "file",
      lineStart,
      lineEnd: lineStart + window.lines.length - 1,
      totalLines: window.totalLines,
      truncated: window.truncated,
    },
  } satisfies PiAgent.AgentToolResult<ReadToolDetails>;
});

export const readDirectory = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  _pathService: EffectPath.Path,
  path: string,
) {
  const entries = yield* fs.readDirectory(path);
  const sorted = [...entries].sort((left, right) => left.localeCompare(right));
  return {
    content: [{ type: "text", text: sorted.join("\n") }],
    details: {
      path,
      type: "directory",
      entries: sorted.length,
      truncated: false,
    },
  } satisfies PiAgent.AgentToolResult<ReadToolDetails>;
});
