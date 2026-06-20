import type { GrepMatch } from "./grepOperations";
import { boundUtf8Text } from "./textBounds";

const maxGrepOutputBytes = 1024 * 1024;
const maxGrepScannedBytes = 8 * 1024 * 1024;

export interface GrepCollectionState {
  bytes: number;
  currentPath: string;
  scannedBytes: number;
}

export const makeGrepCollectionState = (): GrepCollectionState => ({
  bytes: 0,
  currentPath: "",
  scannedBytes: 0,
});

export const collectGrepScannedBytes = (
  state: GrepCollectionState,
  bytes: number,
): boolean => {
  state.scannedBytes += bytes;
  return state.scannedBytes <= maxGrepScannedBytes;
};

export const isGrepScanBudgetExhausted = (
  state: GrepCollectionState,
): boolean => state.scannedBytes >= maxGrepScannedBytes;

export const collectGrepMatch = (
  matches: Array<GrepMatch>,
  state: GrepCollectionState,
  match: GrepMatch,
): boolean => {
  const header = state.currentPath === match.path ? "" : `${match.path}:`;
  const gap = matches.length === 0 ? "" : "\n";
  const prefix = `${gap}${header}\n  Line ${match.line}: `;
  const boundedPrefix = boundUtf8Text(prefix, maxGrepOutputBytes - state.bytes);
  state.bytes += Math.min(
    boundedPrefix.bytes,
    maxGrepOutputBytes - state.bytes,
  );
  if (boundedPrefix.truncated) {
    return false;
  }
  const boundedText = boundUtf8Text(
    match.text,
    maxGrepOutputBytes - state.bytes,
  );
  state.bytes += Math.min(boundedText.bytes, maxGrepOutputBytes - state.bytes);
  state.currentPath = match.path;
  matches.push({ ...match, text: boundedText.text });
  return !boundedText.truncated;
};

export const collectGrepMatches = (
  matches: Array<GrepMatch>,
  state: GrepCollectionState,
  nextMatches: ReadonlyArray<GrepMatch>,
): boolean => {
  for (const match of nextMatches) {
    if (!collectGrepMatch(matches, state, match)) {
      return false;
    }
  }
  return true;
};
