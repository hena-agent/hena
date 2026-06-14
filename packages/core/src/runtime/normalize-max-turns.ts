export const normalizeMaxTurns = (value: number | undefined): number => {
  if (value === undefined) {
    return 64;
  }
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("maxTurns must be a positive integer");
  }
  return value;
};
