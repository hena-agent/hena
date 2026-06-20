import type { GrepMatch } from "./grepOperations";
import { boundUtf8Text } from "./textBounds";

const maxGrepOutputBytes = 1024 * 1024;

export interface FormattedGrepMatches {
  readonly text: string;
  readonly truncated: boolean;
}

const appendBounded = (
  output: string,
  bytes: number,
  segment: string,
): FormattedGrepMatches & { readonly bytes: number } => {
  const bounded = boundUtf8Text(segment, maxGrepOutputBytes - bytes);
  return {
    bytes: bytes + Math.min(bounded.bytes, maxGrepOutputBytes - bytes),
    text: `${output}${bounded.text}`,
    truncated: bounded.truncated,
  };
};

export const formatMatches = (
  matches: ReadonlyArray<GrepMatch>,
): FormattedGrepMatches => {
  let bytes = 0;
  let current = "";
  let output = "";
  for (const match of matches) {
    const header =
      current === match.path
        ? ""
        : `${output === "" ? "" : "\n"}${match.path}:`;
    const line = `\n  Line ${match.line}: ${match.text}`;
    const next = appendBounded(output, bytes, `${header}${line}`);
    bytes = next.bytes;
    output = next.text;
    current = match.path;
    if (next.truncated) {
      return { text: output, truncated: true };
    }
  }
  return { text: output, truncated: false };
};
