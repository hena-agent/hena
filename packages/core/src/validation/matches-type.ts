import { isRecord } from "./is-record";

export const matchesType = (type: string, value: unknown): boolean => {
  if (type === "array") {
    return Array.isArray(value);
  }
  if (type === "integer") {
    return Number.isInteger(value);
  }
  if (type === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (type === "object") {
    return isRecord(value);
  }
  if (type === "null") {
    return value === null;
  }
  return typeof value === type;
};
