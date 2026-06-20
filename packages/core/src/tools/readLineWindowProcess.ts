import {
  appendSegment,
  finishLine,
  type ReadWindow,
  type ReadWindowState,
} from "./readLineWindowState";

export const processText = (
  state: ReadWindowState,
  text: string,
  offset: number,
  limit: number,
): void => {
  let remaining = text;
  while (remaining.length > 0 && !state.done) {
    const newline = remaining.indexOf("\n");
    if (newline < 0) {
      appendSegment(state, remaining, offset, limit);
      return;
    }
    appendSegment(state, remaining.slice(0, newline), offset, limit);
    finishLine(state, offset, limit);
    remaining = remaining.slice(newline + 1);
  }
};

export const finishWindow = (
  state: ReadWindowState,
  decoder: TextDecoder,
  offset: number,
  limit: number,
): ReadWindow => {
  if (!state.done) {
    processText(state, decoder.decode(), offset, limit);
  }
  if (!state.done && state.lineOpen) {
    finishLine(state, offset, limit);
  }
  return { ...state, lines: state.lines };
};
