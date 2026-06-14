export const raceAbort = async <T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
): Promise<T> => {
  const abortError = (): Error => {
    if (signal.reason instanceof Error) {
      return signal.reason;
    }
    const error = new Error(
      typeof signal.reason === "string" ? signal.reason : "Aborted",
    );
    error.name = "AbortError";
    return error;
  };

  if (signal.aborted) {
    throw abortError();
  }
  let rejectAbort!: (reason?: unknown) => void;
  const abort = new Promise<never>((_resolve, reject) => {
    rejectAbort = reject;
  });
  const onAbort = (): void => {
    rejectAbort(abortError());
  };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    return await Promise.race([operation(), abort]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
};
