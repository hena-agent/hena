import { Effect } from "effect";

export type { RuntimeError } from "./runtime/errors";
export {
  LoopLimitExceeded,
  MissingProvider,
  ResponsePartError,
} from "./runtime/errors";
export type { RuntimeEvent } from "./runtime/events";
export type { Runtime as RuntimeInstance } from "./runtime/service";
export { Runtime } from "./runtime/service";
export type { RegisteredTool, RuntimeTool, ToolHandler } from "./runtime/tool";

export const corePackageName = "@hena-dev/core";

export const corePackageNameEffect = Effect.succeed(corePackageName);
