import { Effect } from "effect";

export {
  CustomPart,
  FilePart,
  JsonValue,
  Message,
  MessageId,
  Part,
  ReasoningPart,
  RunId,
  SessionId,
  TextPart,
  TimestampMillis,
  TokenCount,
  ToolCallId,
  ToolCallPart,
  ToolResultPart,
  Usage,
} from "./domain";

export const corePackageName = "@hena-dev/core";

export const corePackageNameEffect = Effect.succeed(corePackageName);
