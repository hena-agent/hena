import { Effect } from "effect";
import type { AgentError, StopReason, TokenUsage, ToolCall } from "./common";
import { errorFromUnknown } from "./common";
import type { ProviderChunk } from "./provider";
import type { CoreServices } from "./services";
import { emit, type SessionState } from "./state";
import type { AssistantPart } from "./transcript";

export type TurnAccumulator = {
  readonly error: AgentError | undefined;
  readonly parts: readonly AssistantPart[];
  readonly stopReason: StopReason;
  readonly toolCalls: readonly ToolCall[];
  readonly usage: TokenUsage | undefined;
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
    let accumulator = emptyAccumulator();
    let reading = true;
    while (reading) {
      const read = yield* readNext(iterator).pipe(
        Effect.catch((error) =>
          Effect.succeed({ error, type: "failed" } as const),
        ),
      );
      accumulator = yield* applyRead(state, accumulator, read);
      reading = read.type === "chunk" && read.chunk.type !== "finish";
    }
    return accumulator;
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
): Effect.Effect<TurnAccumulator, never, CoreServices> {
  if (read.type === "done") {
    return Effect.succeed(accumulator);
  }
  if (read.type === "failed") {
    return Effect.succeed({
      ...accumulator,
      error: read.error,
      stopReason: "error",
    });
  }
  return applyChunk(state, accumulator, read.chunk);
}

function applyChunk(
  state: SessionState,
  accumulator: TurnAccumulator,
  chunk: ProviderChunk,
): Effect.Effect<TurnAccumulator, never, CoreServices> {
  if (chunk.type === "finish") {
    return Effect.succeed({
      ...accumulator,
      error: chunk.error,
      stopReason: chunk.stopReason,
      usage: chunk.usage,
    });
  }
  const next = appendProviderPart(accumulator, chunk);
  if (chunk.type === "tool_call") {
    return Effect.succeed(next);
  }
  return Effect.map(
    emit(state, { text: chunk.text, type: "message_delta" }),
    () => next,
  );
}

function appendProviderPart(
  accumulator: TurnAccumulator,
  chunk: Exclude<ProviderChunk, { readonly type: "finish" }>,
): TurnAccumulator {
  if (chunk.type === "tool_call") {
    return {
      ...accumulator,
      parts: [
        ...accumulator.parts,
        { toolCall: chunk.toolCall, type: "tool_call" },
      ],
      toolCalls: [...accumulator.toolCalls, chunk.toolCall],
    };
  }
  return {
    ...accumulator,
    parts: [...accumulator.parts, { text: chunk.text, type: "text" }],
  };
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
