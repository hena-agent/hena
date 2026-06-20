import * as PiAgent from "@earendil-works/pi-agent-core";
import * as PiNode from "@earendil-works/pi-agent-core/node";
import * as PiAi from "@earendil-works/pi-ai";
import { assert, it } from "@effect/vitest";
import { Effect, Path as EffectPath, FileSystem, Layer, Option } from "effect";
import { systemError } from "effect/PlatformError";
import { TestClock } from "effect/testing";

import { ExecutionEnvironmentService } from "../execution/ExecutionEnvironmentService";
import {
  ExecutionEnvProvider,
  type ExecutionEnvRequest,
} from "../execution/ExecutionEnvProvider";
import { HarnessService } from "../harness/HarnessService";
import { makeCredentialResolver } from "../model/credentials";
import { PathGuard } from "../path/PathGuard";
import { makeRuntimePathGuardLayer } from "./runtimePathGuardLayer";
import {
  AgentHarnessFactory,
  SessionRuntime,
  type SessionRuntimeHarness,
  SessionRuntimeLoader,
  SessionRuntimeMap,
} from "./SessionRuntime";

const model = PiAi.getModel("openai", "gpt-4o-mini");

const fileInfo = (type: FileSystem.File.Type): FileSystem.File.Info => ({
  type,
  mtime: Option.none(),
  atime: Option.none(),
  birthtime: Option.none(),
  dev: 0,
  ino: Option.none(),
  mode: 0,
  nlink: Option.none(),
  uid: Option.none(),
  gid: Option.none(),
  rdev: Option.none(),
  size: FileSystem.Size(0),
  blksize: Option.none(),
  blocks: Option.none(),
});

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
  readonly loadedSessionID?: string;
  loads: number;
  options?: PiAgent.AgentHarnessOptions;
  request?: ExecutionEnvRequest;
  readonly roots?: ReadonlyArray<string>;
  readonly shellEnv?: Readonly<Record<string, string>>;
  readonly shellPath?: string;
}

const makeLayers = (state: TestState) =>
  Layer.mergeAll(
    SessionRuntimeLoader.layer({
      load: (sessionID) =>
        Effect.gen(function* () {
          state.loads++;
          const session = yield* makeSession(
            state.loadedSessionID ?? sessionID,
          );
          return {
            cwd: "/repo",
            roots: state.roots ?? ["/repo"],
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
        Effect.acquireRelease(
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
          (environment) => environment.cleanup,
        ),
    }),
    FileSystem.layerNoop({
      exists: (path) => Effect.succeed(state.files?.has(path) ?? false),
      readFileString: (path) => Effect.succeed(state.files?.get(path) ?? ""),
      realPath: (path) => Effect.succeed(path),
      stat: (path) =>
        Effect.succeed(fileInfo(path === "/repo" ? "Directory" : "File")),
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

const readEnvironment = (sessionID: string) =>
  Effect.gen(function* () {
    const environment = yield* ExecutionEnvironmentService;
    const harness = yield* HarnessService;
    yield* harness.getModel();
    return environment;
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
        assert.deepStrictEqual(second.currentModel, model);
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

it.effect("shares the execution environment with harness options", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const state: TestState = { loads: 0, creates: 0, cleanups: 0 };
      const layer = SessionRuntimeMap.layer.pipe(
        Layer.provide(makeLayers(state)),
      );

      const environment = yield* readEnvironment("ses_env").pipe(
        Effect.provide(layer),
      );

      assert.strictEqual(state.options?.env, environment.env);
      assert.strictEqual("cleanup" in environment, false);
    }),
  ),
);

it.effect("rejects loader configs with mismatched session ids", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const state: TestState = {
        loads: 0,
        creates: 0,
        cleanups: 0,
        loadedSessionID: "ses_other",
      };
      const layer = SessionRuntimeMap.layer.pipe(
        Layer.provide(makeLayers(state)),
      );

      const error = yield* readSession("ses_expected").pipe(
        Effect.provide(layer),
        Effect.flip,
      );

      assert.strictEqual(error._tag, "SessionRuntimeLoadError");
      assert.strictEqual(state.creates, 0);
    }),
  ),
);

it.effect("normalizes runtime roots before wiring services", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const state: TestState = { loads: 0, creates: 0, cleanups: 0, roots: [] };
      const layer = SessionRuntimeMap.layer.pipe(
        Layer.provide(makeLayers(state)),
      );

      yield* Effect.gen(function* () {
        const guard = yield* PathGuard;
        const authorization =
          yield* guard.authorizeExistingPath("/repo/file.ts");

        assert.strictEqual(authorization.allowedBy, "workspace");
        assert.deepStrictEqual(state.request?.roots, ["/repo"]);
      }).pipe(
        Effect.provide(SessionRuntimeMap.get("ses_roots")),
        Effect.provide(layer),
      );
    }),
  ),
);

it.effect("detects runtime path guard target kinds from filesystem stat", () =>
  Effect.gen(function* () {
    const session = yield* makeSession("ses_path");
    const layer = makeRuntimePathGuardLayer(
      {
        cwd: "/repo",
        model,
        roots: ["/repo"],
        session,
      },
      "ses_path",
    ).pipe(
      Layer.provideMerge(
        FileSystem.layerNoop({
          exists: (path) => Effect.succeed(path === "/repo/file.ts"),
          readLink: (path) =>
            path === "/repo/link.ts"
              ? Effect.succeed("target.ts")
              : Effect.fail(
                  systemError({
                    _tag: "NotFound",
                    module: "FileSystem",
                    method: "readLink",
                    pathOrDescriptor: path,
                  }),
                ),
          realPath: (path) => Effect.succeed(path),
          stat: (path) =>
            Effect.succeed(fileInfo(path === "/repo" ? "Directory" : "File")),
        }),
      ),
      Layer.provideMerge(EffectPath.layer),
    );

    yield* Effect.gen(function* () {
      const guard = yield* PathGuard;
      const directory = yield* guard.authorizeExistingPath("/repo");
      const file = yield* guard.authorizeExistingPath("/repo/file.ts");
      const writableFile = yield* guard.authorizeCreateFile("/repo/file.ts");
      const writableLink = yield* guard.authorizeCreateFile("/repo/link.ts");

      assert.strictEqual(directory.kind, "directory");
      assert.strictEqual(file.kind, "file");
      assert.strictEqual(writableFile.canonicalPath, "/repo/file.ts");
      assert.strictEqual(writableLink.canonicalPath, "/repo/target.ts");
    }).pipe(Effect.provide(layer));
  }),
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
