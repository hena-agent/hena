import { Context } from "effect";

import type { ExecutionEnvironment } from "./ExecutionEnvProvider";

export class ExecutionEnvironmentService extends Context.Service<
  ExecutionEnvironmentService,
  ExecutionEnvironment
>()("@hena-dev/core/ExecutionEnvironmentService") {}
