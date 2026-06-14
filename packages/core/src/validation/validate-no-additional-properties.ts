import type { JsonSchema } from "../tools/tools";

export const validateNoAdditionalProperties = (
  properties: { readonly [key: string]: JsonSchema },
  value: Record<string, unknown>,
  path: string,
): string | undefined => {
  const extra = Object.keys(value).find((key) => properties[key] === undefined);
  return extra === undefined ? undefined : `${path}.${extra} is not allowed`;
};
