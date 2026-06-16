import { Effect } from "effect";

export {
  Message,
  Usage,
} from "./domain/message";

export {
  CustomPart,
  FilePart,
  Part,
  ReasoningPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "./domain/parts";

export {
  JsonValue,
  MediaType,
  MessageId,
  RunId,
  SessionId,
  TimestampMillis,
  TokenCount,
  ToolCallId,
  ToolName,
} from "./domain/primitives";

export const corePackageName = "@hena-dev/core";

export const corePackageNameEffect = Effect.succeed(corePackageName);
