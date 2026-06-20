import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Path as EffectPath, type FileSystem } from "effect";

import type { ReadToolParameters } from "./ReadTool";
import type { ReadToolDetails } from "./readDetails";

export const readFile = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
  params: ReadToolParameters,
) {
  const text = yield* fs.readFileString(path);
  const lines = text.split(/\r?\n/);
  const lineStart = params.offset ?? 1;
  const limit = params.limit ?? 2000;
  const selected = lines.slice(lineStart - 1, lineStart - 1 + limit);
  const body = selected
    .map((line, index) => `${lineStart + index}: ${line}`)
    .join("\n");
  return {
    content: [{ type: "text", text: body }],
    details: {
      path,
      type: "file",
      lineStart,
      lineEnd: lineStart + selected.length - 1,
      totalLines: lines.length,
      truncated: lineStart - 1 + selected.length < lines.length,
    },
  } satisfies PiAgent.AgentToolResult<ReadToolDetails>;
});

export const readDirectory = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  pathService: EffectPath.Path,
  path: string,
) {
  const entries = yield* fs.readDirectory(path);
  const display = yield* Effect.forEach(entries, (entry) =>
    fs
      .stat(pathService.join(path, entry))
      .pipe(
        Effect.map((info) => (info.type === "Directory" ? `${entry}/` : entry)),
      ),
  );
  const sorted = display.sort((left, right) => left.localeCompare(right));
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
