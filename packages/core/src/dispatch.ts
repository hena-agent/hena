import { Effect } from "effect";
import type { AgentError, ToolCall, ToolOutput } from "./common";
import { errorFromUnknown } from "./common";
import { type CoreServices, EventBus, ToolRegistry } from "./services";
import {
  appendEntry,
  emit,
  nextEntryId,
  now,
  type SessionState,
} from "./state";
import { makeToolUpdateSink } from "./tool-update-sink";
import { validateInput } from "./tool-validation";
import type { Tool } from "./tools";
import type { ToolResultEntry } from "./transcript";

type ToolDispatchResult = { readonly type: "completed" | "aborted" };

type ToolRun = {
  readonly output: ToolOutput;
  readonly type: "success" | "error" | "aborted";
};

type ExecuteToolOptions = {
  readonly input: unknown;
  readonly signal: AbortSignal;
};

export function dispatchToolCalls(
  state: SessionState,
  calls: readonly ToolCall[],
  signal: AbortSignal,
): Effect.Effect<ToolDispatchResult, never, CoreServices> {
  return Effect.gen(function* () {
    for (const call of calls) {
      if (signalAborted(signal)) {
        return { type: "aborted" };
      }
      const run = yield* dispatchToolCall(state, call, signal);
      if (run.type === "aborted" || signalAborted(signal)) {
        return { type: "aborted" };
      }
    }
    return { type: "completed" };
  });
}

function dispatchToolCall(
  state: SessionState,
  call: ToolCall,
  signal: AbortSignal,
): Effect.Effect<ToolRun, never, CoreServices> {
  return Effect.gen(function* () {
    const registry = yield* ToolRegistry;
    yield* emit(state, { toolCall: call, type: "tool_start" });
    const tool = registry.get(call.name);
    const run =
      tool === undefined
        ? errorRun(`Unknown tool: ${call.name}`)
        : yield* runKnownTool(state, call, tool, signal);
    const entry = yield* makeToolResult(state, call, run);
    yield* appendEntry(state, entry);
    yield* emit(state, { entry, type: "tool_end" });
    return run;
  });
}

function runKnownTool(
  state: SessionState,
  call: ToolCall,
  tool: Tool,
  signal: AbortSignal,
): Effect.Effect<ToolRun, never, CoreServices> {
  return Effect.gen(function* () {
    const validation = yield* validateInput(tool, call.input);
    if (validation.type === "invalid") {
      return errorRun(validation.message);
    }
    return yield* executeTool(state, call, tool, {
      input: validation.input,
      signal,
    });
  });
}

function executeTool(
  state: SessionState,
  call: ToolCall,
  tool: Tool,
  options: ExecuteToolOptions,
): Effect.Effect<ToolRun, never, CoreServices> {
  return Effect.gen(function* () {
    const bus = yield* EventBus;
    const updates = makeToolUpdateSink(state, bus, call.id);
    return yield* Effect.tryPromise({
      catch: (cause: unknown) =>
        errorFromUnknown(cause, { signal: options.signal }),
      try: async (runtimeSignal: AbortSignal): Promise<ToolOutput> => {
        const signal = AbortSignal.any([options.signal, runtimeSignal]);
        const output = await Promise.resolve(
          tool.execute(options.input, {
            sessionId: state.id,
            signal,
            toolCallId: call.id,
            update: updates.update,
          }),
        );
        return output;
      },
    }).pipe(
      Effect.ensuring(Effect.promise(updates.close)),
      Effect.map((output) => ({ output, type: "success" }) satisfies ToolRun),
      Effect.catch((error) => Effect.succeed(toolRunFromError(error))),
    );
  });
}

function makeToolResult(
  state: SessionState,
  call: ToolCall,
  run: ToolRun,
): Effect.Effect<ToolResultEntry> {
  return Effect.map(nextEntryId(state), (id) => ({
    content: run.output,
    id,
    isError: run.type !== "success",
    role: "tool_result",
    timestamp: now(),
    toolCallId: call.id,
    toolName: call.name,
  }));
}

function errorRun(message: string): ToolRun {
  return { output: { text: message, type: "text" }, type: "error" };
}

function abortedRun(message: string): ToolRun {
  return { output: { text: message, type: "text" }, type: "aborted" };
}

function toolRunFromError(error: AgentError): ToolRun {
  return error.category === "aborted"
    ? abortedRun(error.message)
    : errorRun(error.message);
}
const signalAborted = (signal: AbortSignal): boolean => signal.aborted;
