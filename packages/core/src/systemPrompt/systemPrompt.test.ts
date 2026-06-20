import type * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";

import { buildSystemPrompt, DEFAULT_SYSTEM_PROMPT } from "./systemPrompt";

const model = PiAi.getModel("openai", "gpt-4o-mini");
const skill = {
  name: "review",
  description: "Review code changes",
  content: "Review carefully.",
  filePath: "/skills/review/SKILL.md",
} satisfies PiAgent.Skill;

it.effect(
  "composes base, environment, skills, tools, and project instructions",
  () =>
    Effect.gen(function* () {
      const prompt = yield* buildSystemPrompt({
        baseInstructions: "Base override.",
        cwd: "/workspace",
        roots: ["/workspace", "/shared"],
        os: "darwin",
        date: "2026-06-19",
        model,
        thinkingLevel: "minimal",
        activeToolNames: ["read", "bash", "question"],
        skills: [skill],
        projectInstructions: [
          { path: "/workspace/AGENTS.md", content: "Use bun." },
        ],
        extraInstructions: "Server override.",
      });

      assert.ok(prompt.includes("Base override."));
      assert.ok(prompt.includes("cwd: /workspace"));
      assert.ok(prompt.includes("roots: /workspace, /shared"));
      assert.ok(prompt.includes("date: 2026-06-19"));
      assert.ok(prompt.includes("active model: openai/gpt-4o-mini"));
      assert.ok(prompt.includes("thinking level: minimal"));
      assert.ok(prompt.includes("active tools: read, bash, question"));
      assert.ok(prompt.includes("Ask a Question"));
      assert.ok(prompt.includes("<available_skills>"));
      assert.ok(prompt.includes("<name>review</name>"));
      assert.ok(prompt.includes("/workspace/AGENTS.md"));
      assert.ok(prompt.includes("Use bun."));
      assert.ok(prompt.includes("Server override."));
    }),
);

it.effect("uses the default base prompt and Effect clock date", () =>
  Effect.gen(function* () {
    yield* TestClock.setTime(0);
    const prompt = yield* buildSystemPrompt({
      cwd: "/workspace",
      roots: ["/workspace"],
      os: "darwin",
      model,
      thinkingLevel: "off",
    });

    assert.ok(prompt.includes(DEFAULT_SYSTEM_PROMPT));
    assert.ok(prompt.includes("date: 1970-01-01T00:00:00.000Z"));
    assert.ok(prompt.includes("active tools: none"));
    assert.ok(!prompt.includes("Ask a Question"));
    assert.ok(!prompt.includes("<available_skills>"));
    assert.ok(!prompt.includes("Project instructions"));
  }),
);
