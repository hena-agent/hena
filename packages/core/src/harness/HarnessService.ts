import { Context, Layer } from "effect";

import { makeHarnessService } from "./makeHarnessService";
import type { HarnessLike, HarnessServiceShape } from "./types";

export class HarnessService extends Context.Service<
  HarnessService,
  HarnessServiceShape
>()("@hena-dev/core/HarnessService") {
  static readonly fromHarness = (
    harness: HarnessLike,
  ): Layer.Layer<HarnessService> =>
    Layer.effect(this)(makeHarnessService(harness));
}
