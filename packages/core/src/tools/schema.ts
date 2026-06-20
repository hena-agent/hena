import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Effect, Schema } from "effect";

import {
  type AgentToolParameters,
  toAgentToolParameters,
} from "./jsonSchemaParameters";
import { type ToolExecutionError, ToolInputError } from "./toolErrors";

export type { ToolExecutionError } from "./toolErrors";

export interface AgentToolExecuteInput<Parameters, Details> {
  readonly params: Parameters;
  readonly signal?: AbortSignal;
  readonly toolCallId: string;
  readonly update: (
    partialResult: PiAgent.AgentToolResult<Details>,
  ) => Effect.Effect<void>;
}

export type ToolInvocationContext<Details> = Omit<
  AgentToolExecuteInput<never, Details>,
  "params"
>;

export type CoreAgentTool<Details> = PiAgent.AgentTool<
  AgentToolParameters,
  Details
>;

export const toolReferenceFromContext = <Details>(
  context: ToolInvocationContext<Details> | undefined,
): { readonly callID: string } | undefined =>
  context === undefined ? undefined : { callID: context.toolCallId };

export interface AgentToolDefinition<
  ParametersSchema extends Schema.Decoder<unknown, never>,
  Details,
  Requirements = never,
> {
  readonly description: string;
  readonly execute: (
    input: AgentToolExecuteInput<ParametersSchema["Type"], Details>,
  ) => Effect.Effect<
    PiAgent.AgentToolResult<Details>,
    ToolExecutionError,
    Requirements
  >;
  readonly label: string;
  readonly name: string;
  readonly parameters: ParametersSchema;
}

export const makeAgentTool = <
  ParametersSchema extends Schema.Decoder<unknown, never>,
  Details,
>(
  definition: AgentToolDefinition<ParametersSchema, Details, never>,
): CoreAgentTool<Details> => ({
  label: definition.label,
  name: definition.name,
  description: definition.description,
  parameters: toAgentToolParameters(definition.parameters),
  // oxlint-disable-next-line typescript/promise-function-async
  execute: (
    toolCallId: string,
    params: unknown,
    signal?: AbortSignal,
    onUpdate?: PiAgent.AgentToolUpdateCallback<Details>,
  ): Promise<PiAgent.AgentToolResult<Details>> =>
    Effect.runPromise(
      Effect.gen(function* () {
        const decoded = yield* Schema.decodeUnknownEffect(
          definition.parameters,
        )(params).pipe(
          Effect.mapError(
            (error: unknown) => new ToolInputError({ message: String(error) }),
          ),
        );
        const input = {
          toolCallId,
          params: decoded,
          update: (partialResult: PiAgent.AgentToolResult<Details>) =>
            Effect.sync(() => onUpdate?.(partialResult)),
        } satisfies Omit<
          AgentToolExecuteInput<ParametersSchema["Type"], Details>,
          "signal"
        >;

        return yield* definition.execute(
          signal === undefined ? input : { ...input, signal },
        );
      }),
      { signal },
    ),
});
