import { Schema } from "effect";

/**
 * Typed errors for the agent core. All are schema-backed so they can cross the
 * rpc boundary, and yieldable so they integrate with `Effect.gen`.
 *
 * Terminality (see spec §10):
 * - `ProviderError` and `MaxStepsExceeded` form the run's terminal error
 *   channel ({@link AgentError}).
 * - `ToolDecodeError` and `ToolExecutionError` are NOT terminal: the loop
 *   converts them into tool-result parts with `isError: true` and continues.
 */

/** A failure originating from the language-model provider. Terminal. */
export class ProviderError extends Schema.TaggedErrorClass<ProviderError>()(
  "ProviderError",
  {
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Unknown),
  },
) {}

/** Tool-call arguments failed to decode against the tool's parameter schema. */
export class ToolDecodeError extends Schema.TaggedErrorClass<ToolDecodeError>()(
  "ToolDecodeError",
  {
    toolName: Schema.String,
    message: Schema.String,
  },
) {}

/** A tool's `execute` failed. Surfaced as a tool-result part, not terminal. */
export class ToolExecutionError extends Schema.TaggedErrorClass<ToolExecutionError>()(
  "ToolExecutionError",
  {
    toolName: Schema.String,
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Unknown),
  },
) {}

/** The loop's hard step ceiling was reached. Terminal. */
export class MaxStepsExceeded extends Schema.TaggedErrorClass<MaxStepsExceeded>()(
  "MaxStepsExceeded",
  {
    steps: Schema.Number,
  },
) {}

/** The terminal error channel of a run. */
export type AgentError = ProviderError | MaxStepsExceeded;
