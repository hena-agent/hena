import { isStandardSchema } from "../tools/is-standard-schema";
import type { Tool } from "../tools/tools";

export const assertProviderSchema = (tool: Tool): void => {
  if (isStandardSchema(tool.parameters) && tool.schema === undefined) {
    throw new Error(
      `Standard-schema tool requires provider schema: ${tool.name}`,
    );
  }
};
