import type { JsonSchema } from "../tools/tools";
import { validateSchema } from "./validate-schema";

export const validateJsonSchema = (
  schema: JsonSchema,
  input: unknown,
): string | undefined => validateSchema(schema, input, "input");
