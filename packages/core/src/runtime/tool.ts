import { Effect, Schema } from "effect";
import type { Tool } from "effect/unstable/ai";

export interface RegisteredTool {
  readonly name: string;
  readonly tool: Tool.Any;
  readonly execute: (params: unknown) => Effect.Effect<unknown, unknown>;
}

type ToolConfig<
  Parameters extends Schema.Decoder<unknown>,
  Success extends Schema.Schema<unknown>,
> = {
  readonly parameters: Parameters;
  readonly success: Success;
  readonly failure: Schema.Top;
  readonly failureMode: Tool.FailureMode;
};

export type RuntimeTool<
  Name extends string,
  Parameters extends Schema.Decoder<unknown>,
  Success extends Schema.Schema<unknown>,
> = Tool.Tool<Name, ToolConfig<Parameters, Success>, never>;

export type ToolHandler<
  Parameters extends Schema.Decoder<unknown>,
  Success extends Schema.Schema<unknown>,
  E,
> = (params: Parameters["Type"]) => Effect.Effect<Success["Type"], E>;

export const makeRegisteredTool = <
  const Name extends string,
  Parameters extends Schema.Decoder<unknown>,
  Success extends Schema.Schema<unknown>,
  E,
>(
  tool: RuntimeTool<Name, Parameters, Success>,
  execute: ToolHandler<Parameters, Success, E>,
): RegisteredTool => {
  const decode = Schema.decodeUnknownSync(tool.parametersSchema);

  return {
    name: tool.name,
    tool,
    execute: (params: unknown) =>
      Effect.try({
        try: () => decode(params),
        catch: (error: unknown) => error,
      }).pipe(Effect.flatMap(execute)),
  };
};
