import type * as PiAgent from "@earendil-works/pi-agent-core";

const snapshotTool = (tool: PiAgent.AgentTool): PiAgent.AgentTool => ({
  ...tool,
});

export const snapshotTools = (
  tools: ReadonlyArray<PiAgent.AgentTool>,
): Array<PiAgent.AgentTool> => tools.map(snapshotTool);

export const snapshotResources = (
  resources: PiAgent.AgentHarnessResources,
): PiAgent.AgentHarnessResources => ({
  ...(resources.promptTemplates === undefined
    ? {}
    : {
        promptTemplates: resources.promptTemplates.map((template) => ({
          ...template,
        })),
      }),
  ...(resources.skills === undefined
    ? {}
    : { skills: resources.skills.map((skill) => ({ ...skill })) }),
});

export const snapshotStreamOptions = (
  options: PiAgent.AgentHarnessStreamOptions,
): PiAgent.AgentHarnessStreamOptions => ({
  ...options,
  ...(options.headers === undefined ? {} : { headers: { ...options.headers } }),
  ...(options.metadata === undefined
    ? {}
    : { metadata: { ...options.metadata } }),
});
