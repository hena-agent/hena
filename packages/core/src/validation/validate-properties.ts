import type { JsonSchema } from "../tools/tools";
import type { SchemaValidator } from "./schema-validator";
import { validateNoAdditionalProperties } from "./validate-no-additional-properties";

export const validateProperties = (
  validate: SchemaValidator,
  schema: JsonSchema,
  value: Record<string, unknown>,
  path: string,
): string | undefined => {
  const properties = schema.properties ?? {};
  for (const [key, propertySchema] of Object.entries(properties)) {
    if (key in value) {
      const error = validate(propertySchema, value[key], `${path}.${key}`);
      if (error !== undefined) {
        return error;
      }
    }
  }
  if (schema.additionalProperties === false) {
    return validateNoAdditionalProperties(properties, value, path);
  }
  return undefined;
};
