import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect } from "effect";

import type { ExecutionEnvironment } from "../execution/ExecutionEnvProvider";
import type { CredentialResolverShape } from "../model/credentials";
import { snapshotModel } from "../model/customModel";
import type {
  HarnessCredentialCallback,
  MakeAgentHarnessOptionsInput,
} from "./optionsTypes";
import {
  snapshotResources,
  snapshotStreamOptions,
  snapshotTools,
} from "./snapshots";
import { makeHarnessSystemPromptCallback } from "./systemPromptCallback";

interface MakeOptionsFromEnvironmentInput extends MakeAgentHarnessOptionsInput {
  readonly environment: ExecutionEnvironment;
}

const credentialCallback =
  (credentials: CredentialResolverShape): HarnessCredentialCallback =>
  // oxlint-disable-next-line typescript/promise-function-async
  (
    model: Parameters<HarnessCredentialCallback>[0],
  ): ReturnType<HarnessCredentialCallback> =>
    Effect.runPromise(credentials.getApiKeyAndHeaders(model));

export const makeAgentHarnessOptionsFromEnvironment = (
  input: MakeOptionsFromEnvironmentInput,
): PiAgent.AgentHarnessOptions => {
  const environment = input.environment;
  return {
    env: environment.env,
    session: input.session,
    model: snapshotModel(input.model),
    systemPrompt: makeHarnessSystemPromptCallback(
      input.systemPrompt,
      environment,
    ),
    ...(input.activeToolNames === undefined
      ? {}
      : { activeToolNames: [...input.activeToolNames] }),
    ...(input.credentials === undefined
      ? {}
      : { getApiKeyAndHeaders: credentialCallback(input.credentials) }),
    ...(input.resources === undefined
      ? {}
      : { resources: snapshotResources(input.resources) }),
    ...(input.streamOptions === undefined
      ? {}
      : { streamOptions: snapshotStreamOptions(input.streamOptions) }),
    ...(input.thinkingLevel === undefined
      ? {}
      : { thinkingLevel: input.thinkingLevel }),
    ...(input.tools === undefined ? {} : { tools: snapshotTools(input.tools) }),
  } satisfies PiAgent.AgentHarnessOptions;
};
