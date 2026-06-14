import type { ToolOutput } from "../common/common";
import type { EventBusService } from "../services/services";
import type { SessionState } from "../state/state";
import { publishToolUpdate } from "./publish-tool-update";
import type { ToolUpdateSink } from "./tool-update-sink";

export const makeToolUpdateSink = (
  state: SessionState,
  bus: EventBusService,
  toolCallId: string,
): ToolUpdateSink => {
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
};
