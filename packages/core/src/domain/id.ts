import { Schema } from "effect";

/**
 * Branded identifiers for the canonical domain model.
 *
 * Ids are nominally distinct branded strings so that, for example, a
 * {@link SessionId} can never be passed where a {@link MessageId} is expected.
 * Values are produced by the injected `IdGenerator` (see the spec, section 6.3)
 * and are only decoded/encoded at transport and persistence boundaries.
 */

/** Identifies a conversation/session. Sessions are an extension-level concept. */
export const SessionId = Schema.String.pipe(Schema.brand("SessionId"));
export type SessionId = typeof SessionId.Type;

/** Identifies a single `run(input)` invocation of the agent loop. */
export const RunId = Schema.String.pipe(Schema.brand("RunId"));
export type RunId = typeof RunId.Type;

/** Identifies a message within a transcript. */
export const MessageId = Schema.String.pipe(Schema.brand("MessageId"));
export type MessageId = typeof MessageId.Type;

/** Identifies a single tool call emitted by the model. */
export const ToolCallId = Schema.String.pipe(Schema.brand("ToolCallId"));
export type ToolCallId = typeof ToolCallId.Type;

/** Identifies a streamed part within a message (text/reasoning/etc.). */
export const PartId = Schema.String.pipe(Schema.brand("PartId"));
export type PartId = typeof PartId.Type;
