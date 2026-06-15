import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import { Response } from "effect/unstable/ai";

import { makePermissionRegistry } from "../permission/permission-registry";
import { makeToolRegistry } from "../tool/tool-registry";
import { executeTool } from "./execute-tool";

it.effect("returns unknown tools as failed tool results", () =>
  Effect.gen(function* () {
    const tools = yield* makeToolRegistry();
    const permissions = yield* makePermissionRegistry();
    const call = Response.toolCallPart({
      id: "call_1",
      name: "missing",
      params: {},
      providerExecuted: false,
    });
    const result = yield* executeTool(tools, permissions, call);

    assert.strictEqual(result.isFailure, true);
    assert.strictEqual(result.result, "Unknown tool: missing");
  }),
);
