import { assert, it } from "@effect/vitest";
import { Schema } from "effect";

import { MessageId, PartId, RunId, SessionId, ToolCallId } from "./id";

it("decodes each branded id from its string representation", () => {
  assert.strictEqual(Schema.decodeSync(SessionId)("ses_1"), "ses_1");
  assert.strictEqual(Schema.decodeSync(RunId)("run_1"), "run_1");
  assert.strictEqual(Schema.decodeSync(MessageId)("msg_1"), "msg_1");
  assert.strictEqual(Schema.decodeSync(ToolCallId)("tc_1"), "tc_1");
  assert.strictEqual(Schema.decodeSync(PartId)("prt_1"), "prt_1");
});

it("guards values by their underlying string type", () => {
  assert.isTrue(Schema.is(SessionId)("ses_1"));
  assert.isFalse(Schema.is(SessionId)(42));
});
