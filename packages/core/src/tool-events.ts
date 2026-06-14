import { Effect, Ref } from "effect";
import type { ToolOutput } from "./common";
import type { EventBusService } from "./services";
import { now, type SessionState } from "./state";

export async function publishToolUpdate(
  state: SessionState,
  bus: EventBusService,
  toolCallId: string,
  partial: ToolOutput,
): Promise<void> {
  await Effect.runPromise(
    Effect.gen(function* () {
      const sequence = yield* Ref.getAndUpdate(
        state.sequence,
        (value) => value + 1,
      );
      bus.publish({
        partial,
        schemaVersion: 1,
        sequence,
        sessionId: state.id,
        timestamp: now(),
        toolCallId,
        type: "tool_update",
      });
    }),
  );
}
