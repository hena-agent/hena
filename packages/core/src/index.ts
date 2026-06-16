import { Effect } from "effect";

export {
  CustomPart,
  FilePart,
  Message,
  MessageId,
  Part,
  ReasoningPart,
  RunId,
  SessionId,
  TextPart,
  ToolCallId,
  ToolCallPart,
  ToolResultPart,
  Usage,
} from "./domain";

export const corePackageName = "@hena-dev/core";

export const corePackageNameEffect = Effect.succeed(corePackageName);
