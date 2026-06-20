import type { GrepMatch, GrepResult } from "./grepOperations";
import { boundUtf8Text } from "./textBounds";

const maxGrepInputBytes = 1024 * 1024;

interface GrepStreamState {
  bytes: number;
  done: boolean;
  line: number;
  lineOpen: boolean;
  matches: Array<GrepMatch>;
  pending: string;
  truncated: boolean;
}

export interface GrepStreamContext {
  readonly file: string;
  readonly limit: number;
  readonly pattern: RegExp;
  readonly state: GrepStreamState;
}

const makeState = (): GrepStreamState => ({
  bytes: 0,
  done: false,
  line: 0,
  lineOpen: false,
  matches: [],
  pending: "",
  truncated: false,
});

export const makeGrepStreamContext = (
  pattern: RegExp,
  file: string,
  limit: number,
): GrepStreamContext => ({ pattern, file, limit, state: makeState() });

const finishLine = (context: GrepStreamContext): void => {
  const { file, limit, pattern, state } = context;
  state.line += 1;
  state.lineOpen = false;
  const text = state.pending.replace(/\r$/, "");
  state.pending = "";
  pattern.lastIndex = 0;
  if (!pattern.test(text)) {
    return;
  }
  if (state.matches.length >= limit) {
    state.truncated = true;
    state.done = true;
    return;
  }
  state.matches.push({ path: file, line: state.line, text });
};

const appendText = (state: GrepStreamState, text: string): void => {
  state.lineOpen = state.lineOpen || text.length > 0;
  const bounded = boundUtf8Text(text, maxGrepInputBytes - state.bytes);
  state.pending += bounded.text;
  state.bytes += Math.min(bounded.bytes, maxGrepInputBytes - state.bytes);
  if (bounded.truncated) {
    state.truncated = true;
    state.done = true;
  }
};

const countNewline = (state: GrepStreamState): void => {
  state.bytes += Math.min(1, maxGrepInputBytes - state.bytes);
  if (state.bytes >= maxGrepInputBytes) {
    state.truncated = true;
    state.done = true;
  }
};

export const processGrepText = (
  context: GrepStreamContext,
  text: string,
): void => {
  let remaining = text;
  while (remaining.length > 0 && !context.state.done) {
    const newline = remaining.indexOf("\n");
    if (newline < 0) {
      appendText(context.state, remaining);
      return;
    }
    appendText(context.state, remaining.slice(0, newline));
    finishLine(context);
    countNewline(context.state);
    remaining = remaining.slice(newline + 1);
  }
};

export const finishGrepStream = (context: GrepStreamContext): GrepResult => {
  const { state } = context;
  if (state.lineOpen || state.pending !== "") {
    finishLine(context);
  }
  return { matches: state.matches, truncated: state.truncated };
};
