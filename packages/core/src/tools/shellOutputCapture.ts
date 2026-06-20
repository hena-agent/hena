import { boundUtf8Text } from "./textBounds";

const maxShellOutputBytes = 1024 * 1024;

export interface BoundedShellOutput {
  readonly output: string;
  readonly truncated: boolean;
}

export interface ShellOutputCapture {
  bytes: number;
  output: string;
  truncated: boolean;
}

export const boundedShellOutput = (output: string): BoundedShellOutput => {
  const bounded = boundUtf8Text(output, maxShellOutputBytes);
  return { output: bounded.text, truncated: bounded.truncated };
};

export const makeShellAbortController = (
  signal?: AbortSignal,
): AbortController => {
  const controller = new AbortController();
  if (signal?.aborted === true) {
    controller.abort();
    return controller;
  }
  signal?.addEventListener(
    "abort",
    () => {
      controller.abort();
    },
    { once: true },
  );
  return controller;
};

export const makeShellOutputCapture = (): ShellOutputCapture => ({
  bytes: 0,
  output: "",
  truncated: false,
});

export const appendShellCapture = (
  capture: ShellOutputCapture,
  chunk: string,
): void => {
  if (capture.truncated) {
    return;
  }
  const remaining = maxShellOutputBytes - capture.bytes;
  const bounded = boundUtf8Text(chunk, remaining);
  capture.output += bounded.text;
  capture.bytes += Math.min(bounded.bytes, remaining);
  if (bounded.truncated) {
    capture.truncated = true;
  }
};
