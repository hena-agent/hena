import { Layer } from "effect";
import type { EventObserver } from "../extensions/extension";
import type { Provider } from "../provider/provider";
import type { Tool } from "../tools/tools";
import { makeEventBusLayer } from "./make-event-bus-layer";
import { makeToolRegistry } from "./make-tool-registry";
import { type CoreServices, ProviderPort, ToolRegistry } from "./services";

export const makeCoreLayer = (
  provider: Provider,
  tools: readonly Tool[],
  observers: readonly EventObserver[],
): Layer.Layer<CoreServices> =>
  Layer.mergeAll(
    Layer.succeed(ProviderPort, provider),
    Layer.succeed(ToolRegistry, makeToolRegistry(tools)),
    makeEventBusLayer(observers),
  );
