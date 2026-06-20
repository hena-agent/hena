import * as PiAgent from "@earendil-works/pi-agent-core";
import type * as PiAi from "@earendil-works/pi-ai";
import { DateTime, Effect } from "effect";

export const DEFAULT_SYSTEM_PROMPT =
  "You are Hena, a local-first coding agent. Be direct, accurate, and careful with the user's workspace.";

export interface ProjectInstruction {
  readonly content: string;
  readonly path: string;
}

export interface SystemPromptInput<TApi extends PiAi.Api = PiAi.Api> {
  readonly activeToolNames?: ReadonlyArray<string>;
  readonly baseInstructions?: string;
  readonly cwd: string;
  readonly date?: string;
  readonly extraInstructions?: string;
  readonly model: PiAi.Model<TApi>;
  readonly os: string;
  readonly projectInstructions?: ReadonlyArray<ProjectInstruction>;
  readonly roots: ReadonlyArray<string>;
  readonly skills?: ReadonlyArray<PiAgent.Skill>;
  readonly thinkingLevel: PiAgent.ThinkingLevel;
}

const compact = (lines: ReadonlyArray<string>): string => lines.join("\n");

const environmentBlock = (input: SystemPromptInput, date: string): string =>
  compact([
    "Environment:",
    `cwd: ${input.cwd}`,
    `roots: ${input.roots.join(", ")}`,
    `os: ${input.os}`,
    `date: ${date}`,
    `active model: ${input.model.provider}/${input.model.id}`,
    `thinking level: ${input.thinkingLevel}`,
    `active tools: ${input.activeToolNames?.join(", ") ?? "none"}`,
  ]);

const toolGuidance = compact([
  "Tool guidance:",
  "Use tool schemas as the source of truth. Ask a Question when human input is required.",
]);

const projectInstructionsBlock = (
  instructions: ReadonlyArray<ProjectInstruction>,
): string =>
  compact([
    "Project instructions:",
    ...instructions.flatMap((instruction) => [
      `From ${instruction.path}:`,
      instruction.content,
    ]),
  ]);

export const buildSystemPrompt: <TApi extends PiAi.Api>(
  input: SystemPromptInput<TApi>,
) => Effect.Effect<string> = Effect.fnUntraced(function* (input) {
  const date = input.date ?? DateTime.formatIso(yield* DateTime.now);
  const skills = PiAgent.formatSkillsForSystemPrompt([...(input.skills ?? [])]);
  const sections = [
    input.baseInstructions ?? DEFAULT_SYSTEM_PROMPT,
    environmentBlock(input, date),
    toolGuidance,
  ];

  if (skills !== "") {
    sections.push(skills);
  }
  if (input.projectInstructions !== undefined) {
    sections.push(projectInstructionsBlock(input.projectInstructions));
  }
  if (input.extraInstructions !== undefined) {
    sections.push(input.extraInstructions);
  }

  return sections.join("\n\n");
});
