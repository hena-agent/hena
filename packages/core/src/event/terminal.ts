import { Schema } from "effect";

import { Usage } from "../domain/message";
import { JsonValue } from "../domain/primitives";
import { AgentError } from "../error/agent-error";
import { defineEvent } from "./common";

export const DiagnosticLevel = Schema.Literals([
  "debug",
  "info",
  "warn",
  "error",
]).annotate({ identifier: "DiagnosticLevel" });
export type DiagnosticLevel = Schema.Schema.Type<typeof DiagnosticLevel>;

export const UsageEvent = defineEvent("usage", {
  usage: Usage,
});
export type UsageEvent = Schema.Schema.Type<typeof UsageEvent>;

export const DiagnosticEvent = defineEvent("diagnostic", {
  level: DiagnosticLevel,
  extension: Schema.NonEmptyString,
  message: Schema.String,
  cause: Schema.optionalKey(JsonValue),
});
export type DiagnosticEvent = Schema.Schema.Type<typeof DiagnosticEvent>;

export const ErrorEvent = defineEvent("error", {
  error: AgentError,
});
export type ErrorEvent = Schema.Schema.Type<typeof ErrorEvent>;

export const TerminalEvents = [
  UsageEvent,
  DiagnosticEvent,
  ErrorEvent,
] as const;
