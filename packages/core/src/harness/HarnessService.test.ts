import type * as PiAgent from "@earendil-works/pi-agent-core";
import type * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";

import { HarnessService } from "./HarnessService";
import type { HarnessLike } from "./types";

const model: PiAi.Model<PiAi.Api> = {
  id: "model",
  name: "Model",
  api: "openai-completions",
  provider: "openai",
  baseUrl: "https://example.com/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 100_000,
  maxTokens: 4_096,
};

class LayerHarness implements HarnessLike {
  async prompt(text: string): Promise<PiAi.AssistantMessage> {
    await Promise.resolve();
    return {
      role: "assistant",
      content: [{ type: "text", text }],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "stop",
      timestamp: 1,
    };
  }

  async skill(name: string): Promise<PiAi.AssistantMessage> {
    const message = await this.prompt(name);
    return message;
  }

  async promptFromTemplate(name: string): Promise<PiAi.AssistantMessage> {
    const message = await this.prompt(name);
    return message;
  }

  async steer(): Promise<void> {
    await Promise.resolve();
  }

  async followUp(): Promise<void> {
    await Promise.resolve();
  }

  async nextTurn(): Promise<void> {
    await Promise.resolve();
  }

  async abort(): Promise<PiAgent.AbortResult> {
    await Promise.resolve();
    return { clearedSteer: [], clearedFollowUp: [] };
  }

  async compact(): Promise<PiAgent.CompactResult> {
    await Promise.resolve();
    return { summary: "summary", firstKeptEntryId: "ent-1", tokensBefore: 1 };
  }

  async navigateTree(): Promise<PiAgent.NavigateTreeResult> {
    await Promise.resolve();
    return { cancelled: false };
  }

  getModel(): PiAi.Model<PiAi.Api> {
    return model;
  }

  async setModel(): Promise<void> {
    await Promise.resolve();
  }

  getThinkingLevel(): PiAgent.ThinkingLevel {
    return "minimal";
  }

  async setThinkingLevel(): Promise<void> {
    await Promise.resolve();
  }

  getTools(): Array<PiAgent.AgentTool> {
    return [];
  }

  async setTools(): Promise<void> {
    await Promise.resolve();
  }

  getActiveTools(): Array<PiAgent.AgentTool> {
    return [];
  }

  async setActiveTools(): Promise<void> {
    await Promise.resolve();
  }

  getSteeringMode(): PiAgent.QueueMode {
    return "all";
  }

  async setSteeringMode(): Promise<void> {
    await Promise.resolve();
  }

  getFollowUpMode(): PiAgent.QueueMode {
    return "all";
  }

  async setFollowUpMode(): Promise<void> {
    await Promise.resolve();
  }

  getResources(): PiAgent.AgentHarnessResources {
    return {};
  }

  async setResources(): Promise<void> {
    await Promise.resolve();
  }

  getStreamOptions(): PiAgent.AgentHarnessStreamOptions {
    return {};
  }

  async setStreamOptions(): Promise<void> {
    await Promise.resolve();
  }
}

it.effect("provides the service through a Context layer", () =>
  Effect.gen(function* () {
    const service = yield* HarnessService;
    const message = yield* service.prompt("hello");

    assert.deepStrictEqual(message.content, [{ type: "text", text: "hello" }]);
  }).pipe(Effect.provide(HarnessService.fromHarness(new LayerHarness()))),
);
