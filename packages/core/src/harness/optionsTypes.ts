import type * as PiAgent from "@earendil-works/pi-agent-core";

import type { CredentialResolverShape } from "../model/credentials";
import type { HenaModel, HenaThinkingLevel } from "../model/types";
import type { ProjectInstruction } from "../systemPrompt/systemPrompt";

export type HarnessCredentialCallback = NonNullable<
  PiAgent.AgentHarnessOptions["getApiKeyAndHeaders"]
>;

export type HarnessSystemPromptCallback = Exclude<
  NonNullable<PiAgent.AgentHarnessOptions["systemPrompt"]>,
  string
>;

export interface HarnessSystemPromptConfig {
  readonly baseInstructions?: string;
  readonly date?: string;
  readonly extraInstructions?: string;
  readonly os?: string;
  readonly projectInstructions?: ReadonlyArray<ProjectInstruction>;
}

export interface MakeAgentHarnessOptionsInput {
  readonly activeToolNames?: ReadonlyArray<string>;
  readonly credentials?: CredentialResolverShape;
  readonly model: HenaModel;
  readonly resources?: PiAgent.AgentHarnessResources;
  readonly session: PiAgent.Session;
  readonly streamOptions?: PiAgent.AgentHarnessStreamOptions;
  readonly systemPrompt?: HarnessSystemPromptConfig;
  readonly thinkingLevel?: HenaThinkingLevel;
  readonly tools?: ReadonlyArray<PiAgent.AgentTool>;
}
