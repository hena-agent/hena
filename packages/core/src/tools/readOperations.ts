import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type FileSystem } from "effect";

import type { ReadToolParameters } from "./ReadTool";
import type { ReadToolDetails } from "./readDetails";
import { readLineWindow } from "./readLineWindow";
import { boundUtf8Text } from "./textBounds";

const maxDirectoryOutputBytes = 1024 * 1024;

interface DirectoryText {
  readonly text: string;
  readonly truncated: boolean;
}

const formatDirectoryEntries = (
  entries: ReadonlyArray<string>,
): DirectoryText => {
  let bytes = 0;
  let text = "";
  for (const [index, entry] of entries.entries()) {
    const segment = `${index === 0 ? "" : "\n"}${entry}`;
    const bounded = boundUtf8Text(segment, maxDirectoryOutputBytes - bytes);
    text += bounded.text;
    bytes += Math.min(bounded.bytes, maxDirectoryOutputBytes - bytes);
    if (bounded.truncated) {
      return { text, truncated: true };
    }
  }
  return { text, truncated: false };
};

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
  path: string,
) {
  const entries = yield* fs.readDirectory(path);
  const sorted = [...entries].sort((left, right) => left.localeCompare(right));
  const output = formatDirectoryEntries(sorted);
  return {
    content: [{ type: "text", text: output.text }],
    details: {
      path,
      type: "directory",
      entries: sorted.length,
      truncated: output.truncated,
    },
  } satisfies PiAgent.AgentToolResult<ReadToolDetails>;
});
