import type { ProjectInstruction } from "../systemPrompt/systemPrompt";
import type { SessionRuntimeConfig } from "./types";

export const mergeRuntimeSystemPromptConfig = (
  config: SessionRuntimeConfig["systemPrompt"],
  discovered: ReadonlyArray<ProjectInstruction>,
): SessionRuntimeConfig["systemPrompt"] => {
  const configured = config?.projectInstructions ?? [];
  const projectInstructions = [...discovered, ...configured];
  if (config === undefined && projectInstructions.length === 0) {
    return undefined;
  }
  return {
    ...(config ?? {}),
    ...(projectInstructions.length === 0 ? {} : { projectInstructions }),
  };
};
