import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, type Scope } from "effect";

import type { ExecutionEnvProviderError } from "../execution/ExecutionEnvProvider";
import type { CredentialResolverShape } from "../model/credentials";
import type {
  HarnessCredentialCallback,
  MakeAgentHarnessOptionsInput,
} from "./optionsTypes";
import { makeHarnessSystemPromptCallback } from "./systemPromptCallback";

const credentialCallback =
  (credentials: CredentialResolverShape): HarnessCredentialCallback =>
  // oxlint-disable-next-line typescript/promise-function-async
  (
    model: Parameters<HarnessCredentialCallback>[0],
  ): ReturnType<HarnessCredentialCallback> =>
    Effect.runPromise(credentials.getApiKeyAndHeaders(model));

export const makeAgentHarnessOptions: (
  input: MakeAgentHarnessOptionsInput,
) => Effect.Effect<
  PiAgent.AgentHarnessOptions,
  ExecutionEnvProviderError,
  Scope.Scope
> = Effect.fnUntraced(function* (input) {
  const environment = yield* input.execution.provider.create(
    input.execution.request,
  );
  yield* Effect.addFinalizer(() => environment.cleanup);

  return {
    env: environment.env,
    session: input.session,
    model: input.model,
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
    ...(input.resources === undefined ? {} : { resources: input.resources }),
    ...(input.streamOptions === undefined
      ? {}
      : { streamOptions: input.streamOptions }),
    ...(input.thinkingLevel === undefined
      ? {}
      : { thinkingLevel: input.thinkingLevel }),
    ...(input.tools === undefined ? {} : { tools: [...input.tools] }),
  } satisfies PiAgent.AgentHarnessOptions;
});
