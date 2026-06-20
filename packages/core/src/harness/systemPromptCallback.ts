import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect } from "effect";

import type { ExecutionEnvironment } from "../execution/ExecutionEnvProvider";
import { buildSystemPrompt } from "../systemPrompt/systemPrompt";
import type {
  HarnessSystemPromptCallback,
  HarnessSystemPromptConfig,
} from "./optionsTypes";

type PromptContext = Parameters<HarnessSystemPromptCallback>[0];

interface PromptConfigInput {
  readonly baseInstructions?: string;
  readonly date?: string;
  readonly extraInstructions?: string;
  readonly os: string;
  readonly projectInstructions?: NonNullable<
    HarnessSystemPromptConfig["projectInstructions"]
  >;
}

interface PromptContextInput {
  readonly activeToolNames?: ReadonlyArray<string>;
  readonly skills?: ReadonlyArray<PiAgent.Skill>;
}

const activeToolNames = (
  tools: ReadonlyArray<PiAgent.AgentTool>,
): ReadonlyArray<string> | undefined => {
  const names = tools.map((tool) => tool.name);
  return names.length === 0 ? undefined : names;
};

const configInput = (
  config: HarnessSystemPromptConfig | undefined,
): PromptConfigInput => ({
  os: config?.os ?? "unknown",
  ...(config?.baseInstructions === undefined
    ? {}
    : { baseInstructions: config.baseInstructions }),
  ...(config?.date === undefined ? {} : { date: config.date }),
  ...(config?.extraInstructions === undefined
    ? {}
    : { extraInstructions: config.extraInstructions }),
  ...(config?.projectInstructions === undefined
    ? {}
    : { projectInstructions: config.projectInstructions }),
});

const contextInput = (context: PromptContext): PromptContextInput => {
  const names = activeToolNames(context.activeTools);
  return {
    ...(names === undefined ? {} : { activeToolNames: names }),
    ...(context.resources.skills === undefined
      ? {}
      : { skills: context.resources.skills }),
  };
};

export const makeHarnessSystemPromptCallback =
  (
    config: HarnessSystemPromptConfig | undefined,
    environment: ExecutionEnvironment,
  ): HarnessSystemPromptCallback =>
  (context: PromptContext): ReturnType<HarnessSystemPromptCallback> =>
    Effect.runPromise(
      buildSystemPrompt({
        cwd: environment.cwd,
        model: context.model,
        roots: environment.roots,
        thinkingLevel: context.thinkingLevel,
        ...configInput(config),
        ...contextInput(context),
      }),
    );
