import * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer } from "effect";

import type { AgentHarnessFactoryShape } from "./types";

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
      Effect.sync(() => new PiAgent.AgentHarness(options)),
  });
}
