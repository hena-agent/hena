import { Effect, Layer, LayerMap } from "effect";

import { makeSessionRuntimeLayer } from "./runtimeLayer";
import { SessionRuntimeLoader } from "./SessionRuntimeLoader";
import type { SessionRuntimeLoadError } from "./types";

export { AgentHarnessFactory } from "./AgentHarnessFactory";
export { SessionRuntimeLoader } from "./SessionRuntimeLoader";
export { SessionRuntime } from "./SessionRuntimeService";
export type {
  AgentHarnessFactoryShape,
  SessionRuntimeConfig,
  SessionRuntimeHarness,
  SessionRuntimeLoaderShape,
  SessionRuntimeShape,
} from "./types";

type BuiltSessionRuntimeLayer = ReturnType<typeof makeSessionRuntimeLayer>;

type LookupSessionRuntimeLayer = Layer.Layer<
  Layer.Success<BuiltSessionRuntimeLayer>,
  Layer.Error<BuiltSessionRuntimeLayer> | SessionRuntimeLoadError,
  Layer.Services<BuiltSessionRuntimeLayer> | SessionRuntimeLoader
>;

const lookupSessionRuntime = (sessionID: string): LookupSessionRuntimeLayer =>
  Layer.unwrap(
    Effect.gen(function* () {
      const loader = yield* SessionRuntimeLoader;
      const config = yield* loader.load(sessionID);
      return makeSessionRuntimeLayer(config);
    }),
  );

export class SessionRuntimeMap extends LayerMap.Service<SessionRuntimeMap>()(
  "@hena-dev/core/SessionRuntimeMap",
  {
    lookup: lookupSessionRuntime,
    idleTimeToLive: "60 minutes",
  },
) {}
