import type { ToolOutput } from "./common";
import type { EventBusService } from "./services";
import type { SessionState } from "./state";
import { publishToolUpdate } from "./tool-events";

export type ToolUpdateSink = {
  readonly close: () => Promise<void>;
  readonly update: (partial: ToolOutput) => Promise<void>;
};

export function makeToolUpdateSink(
  state: SessionState,
  bus: EventBusService,
  toolCallId: string,
): ToolUpdateSink {
  const pending = new Set<Promise<void>>();
  let open = true;
  return {
    close: async (): Promise<void> => {
      open = false;
      await Promise.allSettled(pending);
    },
    update: async (partial: ToolOutput): Promise<void> => {
      if (!open) {
        return;
      }
      const update = publishToolUpdate(state, bus, toolCallId, partial).finally(
        () => {
          pending.delete(update);
        },
      );
      pending.add(update);
      await update;
    },
  };
}
