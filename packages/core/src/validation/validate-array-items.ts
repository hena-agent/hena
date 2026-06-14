import type { JsonSchema } from "../tools/tools";
import type { SchemaValidator } from "./schema-validator";

export const validateArrayItems = (
  validate: SchemaValidator,
  itemSchema: JsonSchema,
  values: readonly unknown[],
  path: string,
): string | undefined => {
  for (const [index, item] of values.entries()) {
    const error = validate(itemSchema, item, `${path}[${index}]`);
    if (error !== undefined) {
      return error;
    }
  }
  return undefined;
};
