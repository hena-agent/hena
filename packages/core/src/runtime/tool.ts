import { Effect, type Schema, type Stream } from "effect";
import { type AiError, type Tool, Toolkit } from "effect/unstable/ai";

export interface RegisteredTool {
  readonly name: string;
  readonly tool: Tool.Any;
  readonly handle: (
    params: unknown,
  ) => Effect.Effect<
    Stream.Stream<Tool.HandlerResult<Tool.Any>, unknown>,
    AiError.AiError
  >;
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
  Name extends string,
  Parameters extends Schema.Decoder<unknown>,
  Success extends Schema.Schema<unknown>,
  E,
> = (
  params: Parameters["Type"],
  context: Toolkit.HandlerContext<RuntimeTool<Name, Parameters, Success>>,
) => Effect.Effect<Success["Type"], E>;

export const makeRegisteredTool = <
  const Name extends string,
  Parameters extends Schema.Decoder<unknown>,
  Success extends Schema.Schema<unknown>,
  E,
>(
  tool: RuntimeTool<Name, Parameters, Success>,
  execute: ToolHandler<Name, Parameters, Success, E>,
): RegisteredTool => {
  const toolkit = Toolkit.make(tool);
  type Handlers = Toolkit.HandlersFrom<Toolkit.Tools<typeof toolkit>>;
  const handlers = toolkit.toHandlers(
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Toolkit cannot infer dynamic generic tool names.
    toolkit.of({
      [tool.name]: (
        params: Parameters["Type"],
        context: Toolkit.HandlerContext<typeof tool>,
      ) => execute(params, context),
    } as unknown as Handlers),
  );

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RegisteredTool erases the specific runtime tool type for registry storage.
  const handle = ((params: unknown) =>
    Effect.gen(function* () {
      const context = yield* handlers;
      const withHandler = yield* toolkit.pipe(Effect.provideContext(context));
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Toolkit decodes unknown model params at runtime.
      return yield* withHandler.handle(tool.name, params as never);
    })) as RegisteredTool["handle"];

  return {
    name: tool.name,
    tool,
    handle,
  };
};
