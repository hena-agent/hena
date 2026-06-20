import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";
import { collectBoundedUtf8Stream } from "./boundedStreamText";
import type { CoreAgentTool, ToolInvocationContext } from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";
import { ToolHttpError } from "./toolErrors";
import { raceAbortSignal } from "./toolSignal";

const WebfetchToolParameters = Schema.Struct({
  url: Schema.String.annotate({ description: "The URL to fetch" }),
});

type WebfetchToolParameters = (typeof WebfetchToolParameters)["Type"];

export interface WebfetchToolDetails {
  readonly url: string;
  readonly status: number;
  readonly bytes: number;
  readonly truncated: boolean;
}

export type WebfetchToolShape = ToolShape<
  WebfetchToolParameters,
  WebfetchToolDetails
>;

const maxWebfetchBytes = 1024 * 1024;
const webfetchTimeout = "30 seconds";

const httpError = (error: unknown): ToolHttpError =>
  new ToolHttpError({ message: String(error) });

const timeoutError = (): ToolHttpError =>
  new ToolHttpError({ message: "Webfetch timed out." });

const makeWebfetchTool = Effect.fnUntraced(function* () {
  const client = yield* HttpClient.HttpClient;
  return {
    execute: Effect.fnUntraced(function* (
      params: WebfetchToolParameters,
      context?: ToolInvocationContext<WebfetchToolDetails>,
    ) {
      const fetch = Effect.gen(function* () {
        const response = yield* client
          .get(params.url)
          .pipe(
            Effect.flatMap(HttpClientResponse.filterStatusOk),
            Effect.mapError(httpError),
          );
        const text = yield* collectBoundedUtf8Stream(
          response.stream,
          maxWebfetchBytes,
        ).pipe(Effect.mapError(httpError));
        return {
          content: [{ type: "text", text: text.text }],
          details: {
            url: params.url,
            status: response.status,
            bytes: text.bytes,
            truncated: text.truncated,
          },
        } satisfies PiAgent.AgentToolResult<WebfetchToolDetails>;
      });
      return yield* raceAbortSignal(fetch, context?.signal).pipe(
        Effect.timeoutOrElse({
          duration: webfetchTimeout,
          orElse: () => Effect.fail(timeoutError()),
        }),
      );
    }),
  } satisfies WebfetchToolShape;
});

export class WebfetchTool extends Context.Service<
  WebfetchTool,
  WebfetchToolShape
>()("@hena-dev/core/WebfetchTool") {
  static Live: Layer.Layer<WebfetchTool, never, HttpClient.HttpClient> =
    Layer.effect(WebfetchTool)(makeWebfetchTool());
}

export const makeWebfetchAgentTool = (
  context: Context.Context<WebfetchTool>,
): CoreAgentTool<WebfetchToolDetails> =>
  makeServiceExecuteAgentTool(context, {
    service: WebfetchTool,
    label: "Webfetch",
    name: "webfetch",
    description: "Fetch URL content",
    parameters: WebfetchToolParameters,
  });
