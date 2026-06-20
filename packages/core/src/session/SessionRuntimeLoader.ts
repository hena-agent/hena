import { Context, Layer } from "effect";

import type { SessionRuntimeLoaderShape } from "./types";

export class SessionRuntimeLoader extends Context.Service<
  SessionRuntimeLoader,
  SessionRuntimeLoaderShape
>()("@hena-dev/core/SessionRuntimeLoader") {
  static layer(
    loader: SessionRuntimeLoaderShape,
  ): Layer.Layer<SessionRuntimeLoader> {
    return Layer.succeed(SessionRuntimeLoader, loader);
  }
}
