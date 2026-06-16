/**
 * `@hena-dev/core` — the thin, stateless agent core.
 *
 * This entrypoint re-exports the public contract surface: the canonical domain
 * model, ports, registry, extension contracts, events, errors, and the agent
 * loop. See `docs/en/spec.md` for the authoritative design.
 */

export { MessageId, PartId, RunId, SessionId, ToolCallId } from "./domain/id";
export { Message, MessageRole } from "./domain/message";
export {
  CustomPart,
  FilePart,
  Part,
  ReasoningPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "./domain/part";
export { Usage } from "./domain/usage";
