import type * as PiAgent from "@earendil-works/pi-agent-core";
import { Context, Effect, Layer, Schema } from "effect";
import { HttpClient, HttpClientResponse } from "effect/unstable/http";

import type { CoreAgentTool } from "./schema";
import {
  makeServiceExecuteAgentTool,
  type ToolShape,
} from "./serviceAgentTool";

export const WebfetchToolParameters = Schema.Struct({
  url: Schema.String.annotate({ description: "The URL to fetch" }),
});

export type WebfetchToolParameters = (typeof WebfetchToolParameters)["Type"];

export interface WebfetchToolDetails {
  readonly url: string;
  readonly status: number;
  readonly bytes: number;
}

export type WebfetchToolShape = ToolShape<
  WebfetchToolParameters,
  WebfetchToolDetails
>;

const encoder = new TextEncoder();

const makeWebfetchTool = Effect.fnUntraced(function* () {
  const client = yield* HttpClient.HttpClient;
  return {
    execute: Effect.fnUntraced(function* (params: WebfetchToolParameters) {
      const response = yield* client
        .get(params.url)
        .pipe(Effect.flatMap(HttpClientResponse.filterStatusOk));
      const text = yield* response.text;
      return {
        content: [{ type: "text", text }],
        details: {
          url: params.url,
          status: response.status,
          bytes: encoder.encode(text).length,
        },
      } satisfies PiAgent.AgentToolResult<WebfetchToolDetails>;
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
