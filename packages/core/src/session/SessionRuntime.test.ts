import * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiNode from "@earendil-works/pi-agent-core/node";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath, FileSystem, Layer } from "effect";
import { TestClock } from "effect/testing";

import {
  ExecutionEnvProvider,
  type ExecutionEnvRequest,
} from "../execution/ExecutionEnvProvider";
import { HarnessService } from "../harness/HarnessService";
import { makeCredentialResolver } from "../model/credentials";
import {
  AgentHarnessFactory,
  SessionRuntime,
  type SessionRuntimeHarness,
  SessionRuntimeLoader,
  SessionRuntimeMap,
} from "./SessionRuntime";

const model = PiAi.getModel("openai", "gpt-4o-mini");

const assistantMessage = (): PiAi.AssistantMessage =>
  PiAi.fauxAssistantMessage("ok", { timestamp: 1 });

const makeSession = (sessionID: string): Effect.Effect<PiAgent.Session> =>
  Effect.promise(async () =>
    new PiAgent.InMemorySessionRepo().create({ id: sessionID }),
  );

const resolvedMessage = async (): Promise<PiAi.AssistantMessage> => {
  await Promise.resolve();
  return assistantMessage();
};

const resolvedVoid = async (): Promise<void> => {
  await Promise.resolve();
};

const resolvedAbort = async (): Promise<PiAgent.AbortResult> => {
  await Promise.resolve();
  return { clearedSteer: [], clearedFollowUp: [] };
};

const resolvedCompact = async (): Promise<PiAgent.CompactResult> => {
  await Promise.resolve();
  return {
    summary: "summary",
    firstKeptEntryId: "ent-1",
    tokensBefore: 1,
  };
};

const resolvedNavigate = async (): Promise<PiAgent.NavigateTreeResult> => {
  await Promise.resolve();
  return { cancelled: false };
};

const makeHarness = (): SessionRuntimeHarness => ({
  prompt: resolvedMessage,
  skill: resolvedMessage,
  promptFromTemplate: resolvedMessage,
  steer: resolvedVoid,
  followUp: resolvedVoid,
  nextTurn: resolvedVoid,
  abort: resolvedAbort,
  compact: resolvedCompact,
  navigateTree: resolvedNavigate,
  getModel: () => model,
  setModel: resolvedVoid,
  getThinkingLevel: () => "off",
  setThinkingLevel: resolvedVoid,
  getTools: () => [],
  setTools: resolvedVoid,
  getActiveTools: () => [],
  setActiveTools: resolvedVoid,
  getSteeringMode: () => "all",
  setSteeringMode: resolvedVoid,
  getFollowUpMode: () => "all",
  setFollowUpMode: resolvedVoid,
  getResources: () => ({}),
  setResources: resolvedVoid,
  getStreamOptions: () => ({}),
  setStreamOptions: resolvedVoid,
  subscribe: () => () => undefined,
});

interface TestState {
  readonly files?: ReadonlyMap<string, string>;
  cleanups: number;
  creates: number;
  loads: number;
  options?: PiAgent.AgentHarnessOptions;
  request?: ExecutionEnvRequest;
  readonly shellEnv?: Readonly<Record<string, string>>;
  readonly shellPath?: string;
}

const makeLayers = (state: TestState) =>
  Layer.mergeAll(
    SessionRuntimeLoader.layer({
      load: (sessionID) =>
        Effect.gen(function* () {
          state.loads++;
          const session = yield* makeSession(sessionID);
          return {
            cwd: "/repo",
            roots: ["/repo"],
            session,
            model,
            ...(state.shellEnv === undefined
              ? {}
              : { shellEnv: state.shellEnv }),
            ...(state.shellPath === undefined
              ? {}
              : { shellPath: state.shellPath }),
            credentials: makeCredentialResolver({
              providers: { openai: { apiKey: "test-key" } },
            }),
          };
        }),
    }),
    AgentHarnessFactory.layer({
      create: (options) =>
        Effect.sync(() => {
          state.creates++;
          state.options = options;
          return makeHarness();
        }),
    }),
    Layer.succeed(ExecutionEnvProvider, {
      create: (request) =>
        Effect.sync(() => {
          state.request = request;
          return {
            cwd: request.cwd,
            roots: request.roots,
            env: new PiNode.NodeExecutionEnv({ cwd: request.cwd }),
            cleanup: Effect.sync(() => {
              state.cleanups++;
            }),
          };
        }),
    }),
    FileSystem.layerNoop({
      exists: (path) => Effect.succeed(state.files?.has(path) ?? false),
      readFileString: (path) => Effect.succeed(state.files?.get(path) ?? ""),
      realPath: (path) => Effect.succeed(path),
    }),
    EffectPath.layer,
  );

const readSession = (sessionID: string) =>
  Effect.gen(function* () {
    const runtime = yield* SessionRuntime;
    const harness = yield* HarnessService;
    const currentModel = yield* harness.getModel();
    return { runtime, currentModel };
  }).pipe(Effect.provide(SessionRuntimeMap.get(sessionID)));

it.effect("caches a session runtime until the idle TTL expires", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const state = { loads: 0, creates: 0, cleanups: 0 };
      const layer = SessionRuntimeMap.layer.pipe(
        Layer.provide(makeLayers(state)),
      );

      yield* Effect.gen(function* () {
        const first = yield* readSession("ses_1");
        const second = yield* readSession("ses_1");

        assert.strictEqual(first.runtime.sessionID, "ses_1");
        assert.strictEqual(second.currentModel, model);
        assert.strictEqual(state.loads, 1);
        assert.strictEqual(state.creates, 1);
        assert.strictEqual(state.cleanups, 0);

        yield* TestClock.adjust("61 minutes");
        yield* Effect.yieldNow;
        assert.strictEqual(state.cleanups, 1);

        yield* readSession("ses_1");
        assert.strictEqual(state.loads, 2);
        assert.strictEqual(state.creates, 2);
      }).pipe(Effect.provide(layer));
    }),
  ),
);

it.effect("builds independent runtimes for different sessions", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const state = { loads: 0, creates: 0, cleanups: 0 };
      const layer = SessionRuntimeMap.layer.pipe(
        Layer.provide(makeLayers(state)),
      );

      yield* Effect.gen(function* () {
        yield* readSession("ses_a");
        yield* readSession("ses_b");

        assert.strictEqual(state.loads, 2);
        assert.strictEqual(state.creates, 2);
      }).pipe(Effect.provide(layer));
    }),
  ),
);

it.effect("passes shell options into the execution environment request", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const state: TestState = {
        loads: 0,
        creates: 0,
        cleanups: 0,
        shellEnv: { HENA_TEST: "1" },
        shellPath: "/bin/zsh",
      };
      const layer = SessionRuntimeMap.layer.pipe(
        Layer.provide(makeLayers(state)),
      );

      yield* readSession("ses_shell").pipe(Effect.provide(layer));

      assert.deepStrictEqual(state.request?.shellEnv, { HENA_TEST: "1" });
      assert.strictEqual(state.request?.shellPath, "/bin/zsh");
    }),
  ),
);

it.effect("injects discovered project instructions into harness options", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const state: TestState = {
        loads: 0,
        creates: 0,
        cleanups: 0,
        files: new Map([
          ["/repo/AGENTS.md", "Use bun."],
          ["/repo/CLAUDE.md", "Be concise."],
        ]),
      };
      const layer = SessionRuntimeMap.layer.pipe(
        Layer.provide(makeLayers(state)),
      );

      yield* readSession("ses_prompt").pipe(Effect.provide(layer));

      const systemPrompt = state.options?.systemPrompt;
      assert.strictEqual(typeof systemPrompt, "function");
      if (typeof systemPrompt === "function") {
        const session = state.options?.session;
        assert.ok(session !== undefined);
        const prompt = yield* Effect.promise(async () =>
          systemPrompt({
            env: new PiNode.NodeExecutionEnv({ cwd: "/repo" }),
            session,
            model,
            thinkingLevel: "off",
            activeTools: [],
            resources: {},
          }),
        );

        assert.ok(prompt.includes("/repo/AGENTS.md"));
        assert.ok(prompt.includes("Use bun."));
        assert.ok(prompt.includes("/repo/CLAUDE.md"));
        assert.ok(prompt.includes("Be concise."));
      }
    }),
  ),
);
