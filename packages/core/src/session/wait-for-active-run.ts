import { Fiber } from "effect";
import type { ManagedRuntime } from "effect/ManagedRuntime";
import { withCleanupGrace } from "../common/with-cleanup-grace";
import type { CoreServices } from "../services/services";
import type { ActiveRun } from "./session";

export const waitForActiveRun = async (
  runtime: ManagedRuntime<CoreServices, never>,
  active: ActiveRun,
): Promise<boolean> => {
  const joined = runtime.runPromise(Fiber.join(active.fiber)).then(
    () => true,
    () => true,
  );
  const completed = await withCleanupGrace(joined, false);
  return completed;
};
