import { boundUtf8Text } from "./textBounds";

const maxReadOutputBytes = 1024 * 1024;

export interface ReadWindow {
  readonly bytes: number;
  readonly lines: ReadonlyArray<string>;
  readonly totalLines: number;
  readonly truncated: boolean;
}

export interface ReadWindowState {
  bytes: number;
  done: boolean;
  lineOpen: boolean;
  lines: Array<string>;
  pending: string;
  totalLines: number;
  truncated: boolean;
}

export const makeReadWindowState = (): ReadWindowState => ({
  bytes: 0,
  done: false,
  lineOpen: false,
  lines: [],
  pending: "",
  totalLines: 0,
  truncated: false,
});

const trimCarriageReturn = (line: string): string =>
  line.endsWith("\r") ? line.slice(0, -1) : line;

const pushPendingLine = (state: ReadWindowState): void => {
  state.lines.push(trimCarriageReturn(state.pending));
  state.pending = "";
};

const shouldCollect = (
  state: ReadWindowState,
  offset: number,
  limit: number,
): boolean => state.totalLines + 1 >= offset && state.lines.length < limit;

export const finishLine = (
  state: ReadWindowState,
  offset: number,
  limit: number,
): void => {
  state.totalLines += 1;
  state.lineOpen = false;
  if (state.totalLines < offset) {
    return;
  }
  if (state.lines.length >= limit) {
    state.truncated = true;
    state.done = true;
    return;
  }
  pushPendingLine(state);
};

export const appendSegment = (
  state: ReadWindowState,
  text: string,
  offset: number,
  limit: number,
): void => {
  state.lineOpen = state.lineOpen || text.length > 0;
  if (!shouldCollect(state, offset, limit)) {
    return;
  }
  const remaining = maxReadOutputBytes - state.bytes;
  const bounded = boundUtf8Text(text, remaining);
  state.pending += bounded.text;
  state.bytes += Math.min(bounded.bytes, remaining);
  if (bounded.truncated) {
    state.totalLines += 1;
    state.truncated = true;
    state.done = true;
    state.lineOpen = false;
    pushPendingLine(state);
  }
};
