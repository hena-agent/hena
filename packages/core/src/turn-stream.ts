import { Effect } from "effect";
import type { AgentError, StopReason, TokenUsage, ToolCall } from "./common";
import { errorFromUnknown } from "./common";
import type { ProviderChunk } from "./provider";
import type { CoreServices } from "./services";
import { emit, type SessionState } from "./state";
import type { AssistantPart } from "./transcript";

export type TurnAccumulator = {
  error: AgentError | undefined;
  readonly parts: AssistantPart[];
  stopReason: StopReason;
  readonly toolCalls: ToolCall[];
  usage: TokenUsage | undefined;
};

type ReadResult =
  | { readonly chunk: ProviderChunk; readonly type: "chunk" }
  | { readonly type: "done" }
  | { readonly error: AgentError; readonly type: "failed" };

export function consumeProviderStream(
  state: SessionState,
  stream: AsyncIterable<ProviderChunk>,
): Effect.Effect<TurnAccumulator, never, CoreServices> {
  return Effect.gen(function* () {
    const iterator = stream[Symbol.asyncIterator]();
    const accumulator = emptyAccumulator();
    try {
      let reading = true;
      while (reading) {
        const read = yield* readNext(iterator).pipe(
          Effect.catch((error) =>
            Effect.succeed({ error, type: "failed" } as const),
          ),
        );
        yield* applyRead(state, accumulator, read);
        reading = read.type === "chunk" && read.chunk.type !== "finish";
      }
      return accumulator;
    } finally {
      yield* closeIterator(iterator);
    }
  });
}

function closeIterator(
  iterator: AsyncIterator<ProviderChunk>,
): Effect.Effect<void> {
  return Effect.promise(async () => {
    try {
      await iterator.return?.();
    } catch {
      return undefined;
    }
  });
}

function readNext(
  iterator: AsyncIterator<ProviderChunk>,
): Effect.Effect<ReadResult, AgentError> {
  return Effect.map(
    Effect.tryPromise({
      catch: errorFromUnknown,
      try: async (): Promise<IteratorResult<ProviderChunk>> => {
        const result = await iterator.next();
        return result;
      },
    }),
    (result) =>
      result.done === true
        ? { type: "done" }
        : { chunk: result.value, type: "chunk" },
  );
}

function applyRead(
  state: SessionState,
  accumulator: TurnAccumulator,
  read: ReadResult,
): Effect.Effect<void, never, CoreServices> {
  if (read.type === "done") {
    return Effect.succeed(undefined);
  }
  if (read.type === "failed") {
    return Effect.sync(() => {
      accumulator.error = read.error;
      accumulator.stopReason = "error";
    });
  }
  return applyChunk(state, accumulator, read.chunk);
}

function applyChunk(
  state: SessionState,
  accumulator: TurnAccumulator,
  chunk: ProviderChunk,
): Effect.Effect<void, never, CoreServices> {
  if (chunk.type === "finish") {
    return Effect.sync(() => {
      accumulator.error = chunk.error;
      accumulator.stopReason = chunk.stopReason;
      accumulator.usage = chunk.usage;
    });
  }
  appendProviderPart(accumulator, chunk);
  if (chunk.type === "tool_call") {
    return Effect.succeed(undefined);
  }
  return Effect.map(
    emit(state, { text: chunk.text, type: "message_delta" }),
    () => undefined,
  );
}

function appendProviderPart(
  accumulator: TurnAccumulator,
  chunk: Exclude<ProviderChunk, { readonly type: "finish" }>,
): void {
  if (chunk.type === "tool_call") {
    accumulator.parts.push({ toolCall: chunk.toolCall, type: "tool_call" });
    accumulator.toolCalls.push(chunk.toolCall);
    return;
  }
  const previous = accumulator.parts.at(-1);
  if (previous?.type === "text") {
    accumulator.parts[accumulator.parts.length - 1] = {
      text: `${previous.text}${chunk.text}`,
      type: "text",
    };
    return;
  }
  accumulator.parts.push({ text: chunk.text, type: "text" });
}

function emptyAccumulator(): TurnAccumulator {
  return {
    error: undefined,
    parts: [],
    stopReason: "completed",
    toolCalls: [],
    usage: undefined,
  };
}
