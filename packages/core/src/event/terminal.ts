import { Schema } from "effect";

import { Usage } from "../domain/message";
import { JsonValue } from "../domain/primitives";
import { AgentError } from "../error/agent-error";
import { EventBaseFields } from "./common";

export const UsageEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("usage"),
  usage: Usage,
}).annotate({ identifier: "UsageEvent" });
export type UsageEvent = Schema.Schema.Type<typeof UsageEvent>;

export const DiagnosticEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("diagnostic"),
  level: Schema.NonEmptyString,
  extension: Schema.NonEmptyString,
  message: Schema.String,
  cause: Schema.optionalKey(JsonValue),
}).annotate({ identifier: "DiagnosticEvent" });
export type DiagnosticEvent = Schema.Schema.Type<typeof DiagnosticEvent>;

export const ErrorEvent = Schema.Struct({
  ...EventBaseFields,
  type: Schema.Literal("error"),
  error: AgentError,
}).annotate({ identifier: "ErrorEvent" });
export type ErrorEvent = Schema.Schema.Type<typeof ErrorEvent>;
