import type * as PiAgent from "@earendil-works/pi-agent-core";
import type * as PiAi from "@earendil-works/pi-ai";
import type { Effect } from "effect";

import type { HarnessServiceError } from "./errors";

export type HarnessLike = Pick<
  PiAgent.AgentHarness,
  | "prompt"
  | "skill"
  | "promptFromTemplate"
  | "steer"
  | "followUp"
  | "nextTurn"
  | "abort"
  | "compact"
  | "navigateTree"
  | "getModel"
  | "setModel"
  | "getThinkingLevel"
  | "setThinkingLevel"
  | "getTools"
  | "setTools"
  | "getActiveTools"
  | "setActiveTools"
  | "getSteeringMode"
  | "setSteeringMode"
  | "getFollowUpMode"
  | "setFollowUpMode"
  | "getResources"
  | "setResources"
  | "getStreamOptions"
  | "setStreamOptions"
>;

export type HarnessServiceShape = {
  readonly [Method in keyof HarnessLike]: HarnessLike[Method] extends (
    ...args: infer Args
  ) => Promise<infer Value>
    ? (...args: Args) => Effect.Effect<Value, HarnessServiceError>
    : HarnessLike[Method] extends (...args: infer Args) => infer Value
      ? (...args: Args) => Effect.Effect<Value>
      : never;
} & {
  readonly switchModel: (
    model: PiAi.Model<PiAi.Api>,
    requestedLevel?: PiAgent.ThinkingLevel,
  ) => Effect.Effect<
    {
      readonly model: PiAi.Model<PiAi.Api>;
      readonly thinkingLevel: PiAgent.ThinkingLevel;
    },
    HarnessServiceError
  >;
};
