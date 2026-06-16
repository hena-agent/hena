import { Effect } from "effect";

export {
  Message,
  Usage,
} from "./message";

export {
  CustomPart,
  FilePart,
  Part,
  ReasoningPart,
  TextPart,
  ToolCallPart,
  ToolResultPart,
} from "./parts";

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
} from "./primitives";

export const corePackageName = "@hena-dev/core";

export const corePackageNameEffect = Effect.succeed(corePackageName);
