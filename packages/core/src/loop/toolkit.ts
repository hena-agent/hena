import { Effect, Stream } from "effect";
import type { Tool, Toolkit } from "effect/unstable/ai";

import type { ToolEntry } from "../tool/tool-registry";

export const makeToolkit = (
  entries: ReadonlyArray<ToolEntry>,
): Toolkit.WithHandler<Record<string, Tool.Any>> => {
  const tools: Record<string, Tool.Any> = {};
  for (const entry of entries) {
    tools[entry.name] = entry.tool;
  }
  return {
    handle: () => Effect.succeed(Stream.die("tools are resolved by core")),
    tools,
  };
};
