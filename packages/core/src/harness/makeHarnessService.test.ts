import * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";

import { HarnessServiceError } from "./errors";
import { makeHarnessService } from "./makeHarnessService";
import type { HarnessLike } from "./types";

const modelOne: PiAi.Model<PiAi.Api> = {
  id: "one",
  name: "Model One",
  api: "openai-completions",
  provider: "openai",
  baseUrl: "https://example.com/v1",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 100_000,
  maxTokens: 4_096,
};

const modelTwo: PiAi.Model<PiAi.Api> = {
  ...modelOne,
  id: "two",
  name: "Model Two",
};

const assistantMessage = (text: string): PiAi.AssistantMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
  api: modelOne.api,
  provider: modelOne.provider,
  model: modelOne.id,
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
});

interface Gate {
  readonly open: () => void;
  readonly promise: Promise<void>;
}

const makeGate = (): Gate => {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, promise };
};

class FakeHarness implements HarnessLike {
  readonly calls: Array<string> = [];
  abortCalls = 0;
  activeTools: Array<PiAgent.AgentTool> = [];
  compactGate: Promise<void> | undefined;
  followUpMode: PiAgent.QueueMode = "all";
  model: PiAi.Model<PiAi.Api> = modelOne;
  promptGate: Promise<void> | undefined;
  resources: PiAgent.AgentHarnessResources = {};
  steeringMode: PiAgent.QueueMode = "all";
  streamOptions: PiAgent.AgentHarnessStreamOptions = {};
  thinkingLevel: PiAgent.ThinkingLevel = "minimal";
  tools: Array<PiAgent.AgentTool> = [];

  async prompt(text: string): Promise<PiAi.AssistantMessage> {
    this.calls.push(`prompt:start:${text}`);
    if (this.promptGate !== undefined) {
      await this.promptGate;
    }
    this.calls.push(`prompt:end:${text}`);
    return assistantMessage(text);
  }

  async skill(
    name: string,
    additionalInstructions?: string,
  ): Promise<PiAi.AssistantMessage> {
    await Promise.resolve();
    this.calls.push(`skill:${name}:${additionalInstructions ?? ""}`);
    return assistantMessage(name);
  }

  async promptFromTemplate(
    name: string,
    args?: Array<string>,
  ): Promise<PiAi.AssistantMessage> {
    await Promise.resolve();
    this.calls.push(`template:${name}:${args?.join(",") ?? ""}`);
    return assistantMessage(name);
  }

  async steer(text: string): Promise<void> {
    await Promise.resolve();
    this.calls.push(`steer:${text}`);
  }

  async followUp(text: string): Promise<void> {
    await Promise.resolve();
    this.calls.push(`followUp:${text}`);
  }

  async nextTurn(text: string): Promise<void> {
    await Promise.resolve();
    this.calls.push(`nextTurn:${text}`);
  }

  async abort(): Promise<PiAgent.AbortResult> {
    await Promise.resolve();
    this.abortCalls += 1;
    this.calls.push("abort");
    return { clearedSteer: [], clearedFollowUp: [] };
  }

  async compact(): Promise<PiAgent.CompactResult> {
    this.calls.push("compact:start");
    if (this.compactGate !== undefined) {
      await this.compactGate;
    }
    this.calls.push("compact:end");
    return { summary: "summary", firstKeptEntryId: "ent-1", tokensBefore: 1 };
  }

  async navigateTree(targetId: string): Promise<PiAgent.NavigateTreeResult> {
    await Promise.resolve();
    this.calls.push(`navigate:${targetId}`);
    return { cancelled: false };
  }

  getModel(): PiAi.Model<PiAi.Api> {
    return this.model;
  }

  async setModel(model: PiAi.Model<PiAi.Api>): Promise<void> {
    await Promise.resolve();
    this.calls.push(`setModel:${model.id}`);
    this.model = model;
  }

  getThinkingLevel(): PiAgent.ThinkingLevel {
    return this.thinkingLevel;
  }

  async setThinkingLevel(level: PiAgent.ThinkingLevel): Promise<void> {
    await Promise.resolve();
    this.calls.push(`setThinking:${level}`);
    this.thinkingLevel = level;
  }

  getTools(): Array<PiAgent.AgentTool> {
    return this.tools;
  }

  async setTools(
    tools: Array<PiAgent.AgentTool>,
    activeToolNames?: Array<string>,
  ): Promise<void> {
    await Promise.resolve();
    this.tools = tools;
    this.activeTools = tools.filter((tool) =>
      activeToolNames?.includes(tool.name),
    );
  }

  getActiveTools(): Array<PiAgent.AgentTool> {
    return this.activeTools;
  }

  async setActiveTools(toolNames: Array<string>): Promise<void> {
    await Promise.resolve();
    this.activeTools = this.tools.filter((tool) =>
      toolNames.includes(tool.name),
    );
  }

  getSteeringMode(): PiAgent.QueueMode {
    return this.steeringMode;
  }

  async setSteeringMode(mode: PiAgent.QueueMode): Promise<void> {
    await Promise.resolve();
    this.steeringMode = mode;
  }

  getFollowUpMode(): PiAgent.QueueMode {
    return this.followUpMode;
  }

  async setFollowUpMode(mode: PiAgent.QueueMode): Promise<void> {
    await Promise.resolve();
    this.followUpMode = mode;
  }

  getResources(): PiAgent.AgentHarnessResources {
    return this.resources;
  }

  async setResources(resources: PiAgent.AgentHarnessResources): Promise<void> {
    await Promise.resolve();
    this.resources = resources;
  }

  getStreamOptions(): PiAgent.AgentHarnessStreamOptions {
    return this.streamOptions;
  }

  async setStreamOptions(
    streamOptions: PiAgent.AgentHarnessStreamOptions,
  ): Promise<void> {
    await Promise.resolve();
    this.streamOptions = streamOptions;
  }
}

class FailingHarness extends FakeHarness {
  override async prompt(): Promise<PiAi.AssistantMessage> {
    await Promise.resolve();
    throw new PiAgent.AgentHarnessError("busy", "already running");
  }
}

class FailingThinkingHarness extends FakeHarness {
  override async setThinkingLevel(): Promise<void> {
    await Promise.resolve();
    this.calls.push("setThinking:fail");
    throw new PiAgent.AgentHarnessError("invalid_argument", "bad thinking");
  }
}

it.effect("serializes structural harness operations", () =>
  Effect.gen(function* () {
    const harness = new FakeHarness();
    const gate = makeGate();
    harness.promptGate = gate.promise;
    const service = yield* makeHarnessService(harness);

    const promptFiber = yield* service
      .prompt("one")
      .pipe(Effect.forkDetach({ startImmediately: true }));
    yield* Effect.yieldNow;
    const compactFiber = yield* service
      .compact()
      .pipe(Effect.forkDetach({ startImmediately: true }));
    yield* Effect.yieldNow;

    assert.deepStrictEqual(harness.calls, ["prompt:start:one"]);

    gate.open();
    yield* Fiber.join(promptFiber);
    yield* Fiber.join(compactFiber);

    assert.deepStrictEqual(harness.calls, [
      "prompt:start:one",
      "prompt:end:one",
      "compact:start",
      "compact:end",
    ]);
  }),
);

it.effect("serializes explicit skill and template invocations", () =>
  Effect.gen(function* () {
    const harness = new FakeHarness();
    const service = yield* makeHarnessService(harness);

    yield* service.skill("review", "focus on tests");
    yield* service.promptFromTemplate("fix", ["bug"]);

    assert.deepStrictEqual(harness.calls, [
      "skill:review:focus on tests",
      "template:fix:bug",
    ]);
  }),
);

it.effect("lets steering operations bypass the structural permit", () =>
  Effect.gen(function* () {
    const harness = new FakeHarness();
    const gate = makeGate();
    harness.promptGate = gate.promise;
    const service = yield* makeHarnessService(harness);

    const promptFiber = yield* service
      .prompt("one")
      .pipe(Effect.forkDetach({ startImmediately: true }));
    yield* Effect.yieldNow;
    yield* service.steer("adjust");

    assert.deepStrictEqual(harness.calls, ["prompt:start:one", "steer:adjust"]);

    gate.open();
    yield* Fiber.join(promptFiber);
  }),
);

it.effect("serializes model switches with structural harness operations", () =>
  Effect.gen(function* () {
    const harness = new FakeHarness();
    const gate = makeGate();
    harness.promptGate = gate.promise;
    const service = yield* makeHarnessService(harness);

    const promptFiber = yield* service
      .prompt("one")
      .pipe(Effect.forkDetach({ startImmediately: true }));
    yield* Effect.yieldNow;
    const switchFiber = yield* service
      .switchModel(modelTwo, "high")
      .pipe(Effect.forkDetach({ startImmediately: true }));
    yield* Effect.yieldNow;

    assert.deepStrictEqual(harness.calls, ["prompt:start:one"]);

    gate.open();
    yield* Fiber.join(promptFiber);
    const result = yield* Fiber.join(switchFiber);

    assert.strictEqual(result.thinkingLevel, "off");
    assert.deepStrictEqual(harness.calls, [
      "prompt:start:one",
      "prompt:end:one",
      "setModel:two",
      "setThinking:off",
    ]);
  }),
);

it.effect(
  "uses the current thinking level when switching without a request",
  () =>
    Effect.gen(function* () {
      const harness = new FakeHarness();
      harness.thinkingLevel = "minimal";
      const service = yield* makeHarnessService(harness);

      const result = yield* service.switchModel(modelTwo);

      assert.strictEqual(result.thinkingLevel, "off");
      assert.deepStrictEqual(harness.calls, [
        "setModel:two",
        "setThinking:off",
      ]);
    }),
);

it.effect("rolls back model switches when thinking level update fails", () =>
  Effect.gen(function* () {
    const harness = new FailingThinkingHarness();
    const service = yield* makeHarnessService(harness);
    const error = yield* service
      .switchModel(modelTwo, "high")
      .pipe(Effect.flip);

    assert.ok(error instanceof HarnessServiceError);
    assert.strictEqual(error.code, "invalid_argument");
    assert.strictEqual(harness.model, modelOne);
    assert.deepStrictEqual(harness.calls, [
      "setModel:two",
      "setThinking:fail",
      "setModel:one",
    ]);
  }),
);

it.effect("normalizes pi harness errors", () =>
  Effect.gen(function* () {
    const service = yield* makeHarnessService(new FailingHarness());
    const error = yield* service.prompt("fail").pipe(Effect.flip);

    assert.ok(error instanceof HarnessServiceError);
    assert.strictEqual(error.code, "busy");
    assert.strictEqual(error.message, "already running");
  }),
);

it.effect("aborts the harness when a structural operation is interrupted", () =>
  Effect.gen(function* () {
    const harness = new FakeHarness();
    const gate = makeGate();
    harness.promptGate = gate.promise;
    const service = yield* makeHarnessService(harness);

    const fiber = yield* service
      .prompt("one")
      .pipe(Effect.forkDetach({ startImmediately: true }));
    yield* Effect.yieldNow;
    yield* Fiber.interrupt(fiber);
    gate.open();

    assert.strictEqual(harness.abortCalls, 1);
  }),
);

it.effect(
  "does not abort non-abortable structural operations when interrupted",
  () =>
    Effect.gen(function* () {
      const harness = new FakeHarness();
      const gate = makeGate();
      harness.compactGate = gate.promise;
      const service = yield* makeHarnessService(harness);

      const fiber = yield* service
        .compact()
        .pipe(Effect.forkDetach({ startImmediately: true }));
      yield* Effect.yieldNow;
      const interruptFiber = yield* Fiber.interrupt(fiber).pipe(
        Effect.forkDetach({ startImmediately: true }),
      );
      yield* Effect.yieldNow;

      assert.strictEqual(harness.abortCalls, 0);
      assert.deepStrictEqual(harness.calls, ["compact:start"]);

      gate.open();
      yield* Fiber.join(interruptFiber).pipe(Effect.exit);

      assert.strictEqual(harness.abortCalls, 0);
      assert.deepStrictEqual(harness.calls, ["compact:start", "compact:end"]);
    }),
);

it.effect("exposes runtime getters and setters", () =>
  Effect.gen(function* () {
    const tool: PiAgent.AgentTool = {
      label: "Example",
      name: "example",
      description: "Example tool",
      parameters: PiAi.Type.Object({}),
      execute: async () => {
        await Promise.resolve();
        return { content: [{ type: "text", text: "ok" }], details: {} };
      },
    };
    const service = yield* makeHarnessService(new FakeHarness());

    yield* service.followUp("later");
    yield* service.nextTurn("next");
    yield* service.abort();
    yield* service.navigateTree("ent-2");
    yield* service.setModel(modelTwo);
    yield* service.setThinkingLevel("high");
    yield* service.setTools([tool], [tool.name]);
    yield* service.setActiveTools([tool.name]);
    yield* service.setSteeringMode("one-at-a-time");
    yield* service.setFollowUpMode("one-at-a-time");
    yield* service.setResources({ skills: [] });
    yield* service.setStreamOptions({ timeoutMs: 1_000 });

    assert.strictEqual(yield* service.getModel(), modelTwo);
    assert.strictEqual(yield* service.getThinkingLevel(), "high");
    assert.deepStrictEqual(yield* service.getTools(), [tool]);
    assert.deepStrictEqual(yield* service.getActiveTools(), [tool]);
    assert.strictEqual(yield* service.getSteeringMode(), "one-at-a-time");
    assert.strictEqual(yield* service.getFollowUpMode(), "one-at-a-time");
    assert.deepStrictEqual(yield* service.getResources(), { skills: [] });
    assert.deepStrictEqual(yield* service.getStreamOptions(), {
      timeoutMs: 1_000,
    });
  }),
);
