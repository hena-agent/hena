import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Path as EffectPath, FileSystem, Stream } from "effect";

import type { ReadToolParameters } from "./ReadTool";
import type { ReadToolDetails } from "./readDetails";

const maxReadFileBytes = FileSystem.MiB(1);

const readBoundedText = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
) {
  const info = yield* fs.stat(path);
  const byteLimit = info.size > maxReadFileBytes ? maxReadFileBytes : info.size;
  const text = yield* fs.stream(path, { bytesToRead: byteLimit }).pipe(
    Stream.decodeText,
    Stream.runFold(
      () => "",
      (body: string, chunk: string) => `${body}${chunk}`,
    ),
  );
  return { text, truncated: info.size > maxReadFileBytes };
});

export const readFile = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
  params: ReadToolParameters,
) {
  const file = yield* readBoundedText(fs, path);
  const lines = file.text.split(/\r?\n/);
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
      truncated:
        file.truncated || lineStart - 1 + selected.length < lines.length,
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
