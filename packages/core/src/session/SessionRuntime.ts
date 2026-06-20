import { Effect, Layer, LayerMap } from "effect";

import { makeSessionRuntimeLayer } from "./runtimeLayer";
import { SessionRuntimeLoader } from "./SessionRuntimeLoader";
import { getSessionID } from "./sessionID";
import type { SessionRuntimeLoadError } from "./types";
import { SessionRuntimeLoadError as LoadError } from "./types";

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
      const loadedSessionID = yield* getSessionID(config.session);
      if (loadedSessionID !== sessionID) {
        return yield* Effect.fail(
          new LoadError({
            message: `Loaded session id ${loadedSessionID} does not match requested session id ${sessionID}`,
          }),
        );
      }
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
