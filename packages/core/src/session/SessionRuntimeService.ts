import { Context } from "effect";

import type { SessionRuntimeShape } from "./types";

export class SessionRuntime extends Context.Service<
  SessionRuntime,
  SessionRuntimeShape
>()("@hena-dev/core/SessionRuntime") {}
