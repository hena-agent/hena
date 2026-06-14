import type { JsonSchema } from "../tools/tools";
import { matchesType } from "./matches-type";

export const validateType = (
  schema: JsonSchema,
  value: unknown,
  path: string,
): string | undefined => {
  if (schema.type === undefined) {
    return undefined;
  }
  if (matchesType(schema.type, value)) {
    return undefined;
  }
  return `${path} must be ${schema.type}`;
};
