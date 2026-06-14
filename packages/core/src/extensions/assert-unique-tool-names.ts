import type { Tool } from "../tools/tools";

export const assertUniqueToolNames = (tools: readonly Tool[]): void => {
  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) {
      throw new Error(`Duplicate tool name: ${tool.name}`);
    }
    names.add(tool.name);
  }
};
