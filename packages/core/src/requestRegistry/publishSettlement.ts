import { Effect } from "effect";

import type { PendingRequestPublish, PendingRequestSettlement } from "./types";

export const publishSettlement = <Event>(
  publish: PendingRequestPublish<Event>,
  settlement: PendingRequestSettlement<Event>,
): Effect.Effect<void> =>
  (settlement.commit ?? Effect.void).pipe(
    Effect.andThen(publish(settlement.event)),
    Effect.asVoid,
  );
