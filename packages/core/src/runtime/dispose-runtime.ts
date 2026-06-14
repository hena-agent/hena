import type { ManagedRuntime } from "effect/ManagedRuntime";
import type { CoreServices } from "../services/services";
import type { Session } from "../session/session";

export const disposeRuntime = async (
  sessions: Map<string, Session>,
  managed: ManagedRuntime<CoreServices, never>,
): Promise<void> => {
  await Promise.all(
    Array.from(sessions.values(), async (session) => {
      await session.dispose();
    }),
  );
  await managed.dispose();
};
