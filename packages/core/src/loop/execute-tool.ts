import { Effect, Option, Result } from "effect";
import { Response } from "effect/unstable/ai";

import type { PermissionRegistry } from "../permission/permission-registry";
import type { ToolRegistry } from "../tool/tool-registry";

type RuntimeToolResult = Response.ToolResultPart<string, unknown, unknown>;

const toolResult = (
  call: Response.ToolCallPart<string, unknown>,
  isFailure: boolean,
  result: unknown,
): RuntimeToolResult =>
  Response.makePart("tool-result", {
    encodedResult: result,
    id: call.id,
    isFailure,
    name: call.name,
    preliminary: false,
    providerExecuted: false,
    result,
  });

export const executeTool = Effect.fnUntraced(function* (
  tools: ToolRegistry,
  permissions: PermissionRegistry,
  call: Response.ToolCallPart<string, unknown>,
) {
  const decision = yield* permissions.check(call);
  if (decision.status === "deny")
    return toolResult(call, true, decision.reason);

  const entry = yield* tools.find(call.name);
  if (Option.isNone(entry)) {
    return toolResult(call, true, `Unknown tool: ${call.name}`);
  }

  const result = yield* entry.value.handler(call.params).pipe(Effect.result);
  return Result.isFailure(result)
    ? toolResult(call, true, String(result.failure))
    : toolResult(call, false, result.success);
});
