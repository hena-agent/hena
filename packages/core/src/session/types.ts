import type * as PiAgent from "@earendil-works/pi-agent-core";
import { type Effect, Schema, type Stream } from "effect";
import type { HarnessEventEnvelope } from "../harness/eventSchema";
import type { HarnessEventSource } from "../harness/events";
import type { HarnessSystemPromptConfig } from "../harness/optionsTypes";
import type { HarnessLike } from "../harness/types";
import type { CredentialResolverShape } from "../model/credentials";
import type { HenaModel, HenaThinkingLevel } from "../model/types";

export class AgentHarnessFactoryError extends Schema.TaggedErrorClass<AgentHarnessFactoryError>()(
  "AgentHarnessFactoryError",
  { message: Schema.String },
) {}

export class SessionRuntimeLoadError extends Schema.TaggedErrorClass<SessionRuntimeLoadError>()(
  "SessionRuntimeLoadError",
  { message: Schema.String },
) {}

export type SessionRuntimeHarness = HarnessLike & HarnessEventSource;

export interface SessionRuntimeConfig {
  readonly activeToolNames?: ReadonlyArray<string>;
  readonly credentials?: CredentialResolverShape;
  readonly cwd: string;
  readonly model: HenaModel;
  readonly resources?: PiAgent.AgentHarnessResources;
  readonly roots: ReadonlyArray<string>;
  readonly session: PiAgent.Session;
  readonly shellEnv?: Readonly<Record<string, string>>;
  readonly shellPath?: string;
  readonly streamOptions?: PiAgent.AgentHarnessStreamOptions;
  readonly systemPrompt?: HarnessSystemPromptConfig;
  readonly thinkingLevel?: HenaThinkingLevel;
  readonly tools?: ReadonlyArray<PiAgent.AgentTool>;
}

export interface SessionRuntimeShape {
  readonly events: Stream.Stream<HarnessEventEnvelope>;
  readonly sessionID: string;
}

export interface SessionRuntimeLoaderShape {
  readonly load: (
    sessionID: string,
  ) => Effect.Effect<SessionRuntimeConfig, SessionRuntimeLoadError>;
}

export interface AgentHarnessFactoryShape {
  readonly create: (
    options: PiAgent.AgentHarnessOptions,
  ) => Effect.Effect<SessionRuntimeHarness, AgentHarnessFactoryError>;
}
