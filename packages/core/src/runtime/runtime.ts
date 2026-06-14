import type { Extension } from "../extensions/extension";
import type { Session } from "../session/session";

export type CreateRuntimeOptions = {
  readonly extensions: readonly Extension[];
  readonly maxTurns?: number;
};

export type HenaRuntime = {
  readonly createSession: () => Session;
  readonly dispose: () => Promise<void>;
};
