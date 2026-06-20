import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer, Schema } from "effect";

import { QuestionService } from "../question/QuestionService";
import { type Answer, Info } from "../question/schema";
import {
  type CoreAgentTool,
  type ToolInvocationContext,
  toolReferenceFromContext,
} from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";

const QuestionToolParameters = Schema.Struct({
  questions: Schema.Array(Info).annotate({
    description: "Questions to ask the user",
  }),
});

type QuestionToolParameters = (typeof QuestionToolParameters)["Type"];

export interface QuestionToolConfig {
  readonly sessionID: string;
}

export interface QuestionToolDetails {
  readonly answers: ReadonlyArray<Answer>;
}

export type QuestionToolShape = ToolShape<
  QuestionToolParameters,
  QuestionToolDetails
>;

const formatAnswers = (answers: ReadonlyArray<Answer>): string =>
  answers.map((answer) => answer.join(", ")).join("\n");

const makeQuestionTool: (
  config: QuestionToolConfig,
) => Effect.Effect<QuestionToolShape, never, QuestionService> =
  Effect.fnUntraced(function* (config) {
    const questions = yield* QuestionService;
    return {
      execute: Effect.fnUntraced(function* (
        params: QuestionToolParameters,
        context?: ToolInvocationContext<QuestionToolDetails>,
      ) {
        const tool = toolReferenceFromContext(context);
        const answers = yield* questions.ask({
          sessionID: config.sessionID,
          questions: params.questions,
          ...(tool === undefined ? {} : { tool }),
        });
        return {
          content: [{ type: "text", text: formatAnswers(answers) }],
          details: { answers },
        } satisfies PiAgent.AgentToolResult<QuestionToolDetails>;
      }),
    } satisfies QuestionToolShape;
  });

export class QuestionTool extends Context.Service<
  QuestionTool,
  QuestionToolShape
>()("@hena-dev/core/QuestionTool") {
  static layer = (
    config: QuestionToolConfig,
  ): Layer.Layer<QuestionTool, never, QuestionService> =>
    Layer.effect(QuestionTool)(makeQuestionTool(config));
}

export const makeQuestionAgentTool = (
  context: Context.Context<QuestionTool>,
): CoreAgentTool<QuestionToolDetails> =>
  makeServiceExecuteAgentTool(context, {
    service: QuestionTool,
    label: "Question",
    name: "question",
    description: "Ask the user questions and wait for answers",
    parameters: QuestionToolParameters,
  });
