import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type FileSystem } from "effect";
import { readBoundedDirectory } from "./directoryEntryBounds";
import type { ReadToolParameters } from "./ReadTool";
import type { ReadToolDetails } from "./readDetails";
import { readLineWindow } from "./readLineWindow";
import { boundUtf8Text } from "./textBounds";

const maxReadOutputBytes = 1024 * 1024;
const maxReadLines = 2000;

interface DirectoryText {
  readonly text: string;
  readonly truncated: boolean;
}

const countEmittedLines = (text: string): number =>
  text.length === 0 ? 0 : text.split("\n").length;

const formatDirectoryEntries = (
  entries: ReadonlyArray<string>,
): DirectoryText => {
  let bytes = 0;
  let text = "";
  for (const [index, entry] of entries.entries()) {
    const segment = `${index === 0 ? "" : "\n"}${entry}`;
    const bounded = boundUtf8Text(segment, maxReadOutputBytes - bytes);
    text += bounded.text;
    bytes += Math.min(bounded.bytes, maxReadOutputBytes - bytes);
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
  const limit = Math.min(params.limit ?? maxReadLines, maxReadLines);
  const window = yield* readLineWindow(fs, path, lineStart, limit);
  const body = window.lines
    .map((line, index) => `${lineStart + index}: ${line}`)
    .join("\n");
  const output = boundUtf8Text(body, maxReadOutputBytes);
  const lineEnd = lineStart + countEmittedLines(output.text) - 1;
  return {
    content: [{ type: "text", text: output.text }],
    details: {
      path,
      type: "file",
      lineStart,
      lineEnd,
      totalLines: window.totalLines,
      truncated: window.truncated || output.truncated,
    },
  } satisfies PiAgent.AgentToolResult<ReadToolDetails>;
});

export const readDirectory = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: string,
) {
  const directoryEntries = yield* readBoundedDirectory(fs, path);
  const sorted = [...directoryEntries.entries].sort((left, right) =>
    left.localeCompare(right),
  );
  const output = formatDirectoryEntries(sorted);
  return {
    content: [{ type: "text", text: output.text }],
    details: {
      path,
      type: "directory",
      entries: sorted.length,
      truncated: directoryEntries.truncated || output.truncated,
    },
  } satisfies PiAgent.AgentToolResult<ReadToolDetails>;
});
