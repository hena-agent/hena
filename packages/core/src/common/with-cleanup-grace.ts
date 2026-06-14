const CLEANUP_GRACE_MS = 10;

export const withCleanupGrace = async <T>(
  work: Promise<T>,
  timeoutValue: T,
): Promise<T> => {
  const delay = async (ms: number, value: T): Promise<T> => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
    return value;
  };

  const result = await Promise.race([
    work,
    delay(CLEANUP_GRACE_MS, timeoutValue),
  ]);
  return result;
};
