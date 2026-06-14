import type { Tool } from "../tools/tools";
import type { ToolRegistryService } from "./services";

export const makeToolRegistry = (
  tools: readonly Tool[],
): ToolRegistryService => ({
  get: (name: string): Tool | undefined =>
    tools.find((tool: Tool) => tool.name === name),
  list: (): readonly Tool[] => tools,
});
