import type * as PiAgent from "@earendil-works/pi-agent-core";
import { type Context, Effect, type Schema } from "effect";

import {
  type AgentToolDefinition,
  type AgentToolExecuteInput,
  type CoreAgentTool,
  makeAgentTool,
  type ToolInvocationContext,
} from "./schema";

export interface ToolShape<Parameters, Details> {
  readonly execute: (
    params: Parameters,
    context?: ToolInvocationContext<Details>,
  ) => Effect.Effect<PiAgent.AgentToolResult<Details>, unknown>;
}

export interface ServiceExecutableAgentToolDefinition<
  ParametersSchema extends Schema.Decoder<unknown, never>,
  Details,
  Requirements,
> extends Omit<
    AgentToolDefinition<ParametersSchema, Details, Requirements>,
    "execute"
  > {
  readonly service: Effect.Effect<
    ToolShape<ParametersSchema["Type"], Details>,
    never,
    Requirements
  >;
}

export const makeServiceAgentTool = <
  ParametersSchema extends Schema.Decoder<unknown, never>,
  Details,
  Requirements,
>(
  context: Context.Context<Requirements>,
  definition: AgentToolDefinition<ParametersSchema, Details, Requirements>,
): CoreAgentTool<Details> =>
  makeAgentTool<ParametersSchema, Details>({
    ...definition,
    execute: (
      input: AgentToolExecuteInput<ParametersSchema["Type"], Details>,
    ) => definition.execute(input).pipe(Effect.provide(context)),
  });

export const makeServiceExecuteAgentTool = <
  ParametersSchema extends Schema.Decoder<unknown, never>,
  Details,
  Requirements,
>(
  context: Context.Context<Requirements>,
  definition: ServiceExecutableAgentToolDefinition<
    ParametersSchema,
    Details,
    Requirements
  >,
): CoreAgentTool<Details> =>
  makeServiceAgentTool(context, {
    label: definition.label,
    name: definition.name,
    description: definition.description,
    parameters: definition.parameters,
    execute: (
      input: AgentToolExecuteInput<ParametersSchema["Type"], Details>,
    ) =>
      Effect.flatMap(definition.service, (tool) =>
        tool.execute(input.params, input),
      ),
  });
