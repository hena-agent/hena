import { Effect } from "effect";

export type { Runtime as RuntimeInstance } from "./runtime/service";
export { Runtime } from "./runtime/service";

export const corePackageName = "@hena-dev/core";

export const corePackageNameEffect = Effect.succeed(corePackageName);
