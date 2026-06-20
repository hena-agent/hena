import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Scope } from "effect";

import type { HarnessEventSource, UnsafeHarnessEventBridge } from "./events";

export const attachHarnessEventBridge = (
  harness: HarnessEventSource,
  bridge: UnsafeHarnessEventBridge,
): Effect.Effect<void, never, Scope.Scope> =>
  Effect.sync(() =>
    harness.subscribe((event: PiAgent.AgentHarnessEvent): void => {
      bridge.publishUnsafe(event);
    }),
  ).pipe(
    Effect.flatMap((unsubscribe) =>
      Effect.addFinalizer(() => Effect.sync(unsubscribe)),
    ),
  );
