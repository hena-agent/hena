import { Effect } from "effect";
import type { AgentError, StopReason, TokenUsage, ToolCall } from "./common";
import { errorFromUnknown } from "./common";
import type { ProviderChunk } from "./provider";
import {
  finishFromError,
  finishFromMissingFinish,
  singleChunkIterator,
} from "./provider-finish";
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

type ProviderStreamFactory = () => AsyncIterable<ProviderChunk>;

export function consumeProviderStream(
  state: SessionState,
  stream: ProviderStreamFactory,
  signal: AbortSignal,
): Effect.Effect<TurnAccumulator, never, CoreServices> {
  return Effect.gen(function* () {
    const iterator = yield* openIterator(stream, signal);
    const accumulator = emptyAccumulator();
    try {
      let reading = true;
      while (reading) {
        const chunk = yield* readNext(iterator, signal);
        yield* applyChunk(state, accumulator, chunk);
        reading = chunk.type !== "finish";
      }
      return accumulator;
    } finally {
      yield* closeIterator(iterator);
    }
  });
}

function openIterator(
  stream: ProviderStreamFactory,
  signal: AbortSignal,
): Effect.Effect<AsyncIterator<ProviderChunk>> {
  return Effect.try({
    catch: (cause: unknown) => errorFromUnknown(cause, { signal }),
    try: () => stream()[Symbol.asyncIterator](),
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed(singleChunkIterator(finishFromError(error))),
    ),
  );
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
  signal: AbortSignal,
): Effect.Effect<ProviderChunk> {
  return Effect.tryPromise({
    catch: (cause: unknown) => errorFromUnknown(cause, { signal }),
    try: async (): Promise<IteratorResult<ProviderChunk>> => {
      const result = await iterator.next();
      return result;
    },
  }).pipe(
    Effect.map(
      (result): ProviderChunk =>
        result.done === true ? finishFromMissingFinish() : result.value,
    ),
    Effect.catch((error) => Effect.succeed(finishFromError(error))),
  );
}

function applyChunk(
  state: SessionState,
  accumulator: TurnAccumulator,
  chunk: ProviderChunk,
): Effect.Effect<void, never, CoreServices> {
  if (chunk.type === "finish") {
    return Effect.sync(() => {
      accumulator.error =
        chunk.stopReason === "error" ? chunk.error : undefined;
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
