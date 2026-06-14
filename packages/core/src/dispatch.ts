import { Effect } from "effect";
import type { ToolCall, ToolOutput } from "./common";
import { errorFromUnknown } from "./common";
import { type CoreServices, EventBus, ToolRegistry } from "./services";
import {
  appendEntry,
  emit,
  nextEntryId,
  now,
  type SessionState,
} from "./state";
import { publishToolUpdate } from "./tool-events";
import { validateInput } from "./tool-validation";
import type { Tool } from "./tools";
import type { ToolResultEntry } from "./transcript";

type ToolRun = {
  readonly isError: boolean;
  readonly output: ToolOutput;
};

type ExecuteToolOptions = {
  readonly input: unknown;
  readonly signal: AbortSignal;
};

export function dispatchToolCalls(
  state: SessionState,
  calls: readonly ToolCall[],
  signal: AbortSignal,
): Effect.Effect<readonly ToolResultEntry[], never, CoreServices> {
  return Effect.gen(function* () {
    const results: ToolResultEntry[] = [];
    for (const call of calls) {
      const result = yield* dispatchToolCall(state, call, signal);
      results.push(result);
    }
    return results;
  });
}

function dispatchToolCall(
  state: SessionState,
  call: ToolCall,
  signal: AbortSignal,
): Effect.Effect<ToolResultEntry, never, CoreServices> {
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
    return entry;
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
            update: async (partial: ToolOutput): Promise<void> => {
              await publishToolUpdate(state, bus, call.id, partial);
            },
          }),
        );
        return output;
      },
    }).pipe(
      Effect.map((output) => ({ isError: false, output }) satisfies ToolRun),
      Effect.catch((error) => Effect.succeed(errorRun(error.message))),
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
    isError: run.isError,
    role: "tool_result",
    timestamp: now(),
    toolCallId: call.id,
    toolName: call.name,
  }));
}

function errorRun(message: string): ToolRun {
  return { isError: true, output: { text: message, type: "text" } };
}
