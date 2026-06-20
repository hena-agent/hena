import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import { ToolRef } from "../toolRef";
import { QuestionID, Request } from "./schema";

it("accepts only que-prefixed question ids", () => {
  assert.strictEqual(Schema.decodeUnknownSync(QuestionID)("que-1"), "que-1");
  assert.throws(() => Schema.decodeUnknownSync(QuestionID)("req-1"));
});

it("preserves question tool message and call ids", () => {
  const tool = Schema.decodeUnknownSync(ToolRef)({
    messageID: "msg-1",
    callID: "call-1",
  });
  const request = Schema.decodeUnknownSync(Request)({
    id: "que-1",
    sessionID: "session-1",
    questions: [],
    tool,
  });

  assert.deepStrictEqual(tool, { messageID: "msg-1", callID: "call-1" });
  assert.deepStrictEqual(request.tool, {
    messageID: "msg-1",
    callID: "call-1",
  });
});
