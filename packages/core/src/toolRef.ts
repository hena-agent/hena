import { Schema } from "effect";

export const ToolRef = Schema.Struct({
  messageID: Schema.optional(Schema.String),
  callID: Schema.String,
});

export type ToolRef = Schema.Schema.Type<typeof ToolRef>;
