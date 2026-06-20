import * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer } from "effect";

import {
  AgentHarnessFactoryError,
  type AgentHarnessFactoryShape,
} from "./types";

const factoryError = (error: unknown): AgentHarnessFactoryError =>
  new AgentHarnessFactoryError({
    message: String(error).replace(/^Error: /, ""),
  });

export class AgentHarnessFactory extends Context.Service<
  AgentHarnessFactory,
  AgentHarnessFactoryShape
>()("@hena-dev/core/AgentHarnessFactory") {
  static layer(
    factory: AgentHarnessFactoryShape,
  ): Layer.Layer<AgentHarnessFactory> {
    return Layer.succeed(AgentHarnessFactory, factory);
  }

  static readonly Live: Layer.Layer<AgentHarnessFactory> = Layer.succeed(this, {
    create: (options: PiAgent.AgentHarnessOptions) =>
      Effect.try({
        try: () => new PiAgent.AgentHarness(options),
        catch: factoryError,
      }),
  });
}
