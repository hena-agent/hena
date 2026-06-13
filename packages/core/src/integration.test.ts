import { afterEach, expect, test } from "vitest";

import type { Extension } from "./extension";
import type { ProviderChunk, ProviderRequest } from "./provider";
import { createRuntime, type HenaRuntime } from "./runtime";

const runtimes: Array<HenaRuntime> = [];

afterEach(async () => {
  await Promise.all(
    runtimes.splice(0).map(async (runtime) => {
      await runtime.dispose();
    }),
  );
});

test("integrates provider, tool registry, observers, and session state", async () => {
  const observed: Array<string> = [];
  const runtime = await makeRuntime([
    providerScript(),
    incrementTool(),
    eventRecorder(observed),
  ]);
  const first = runtime.createSession();
  const second = runtime.createSession();

  await first.prompt("increment");
  await second.prompt("plain");

  expect(first.transcript().map((entry) => entry.role)).toEqual([
    "user",
    "assistant",
    "tool_result",
    "assistant",
  ]);
  expect(second.transcript().map((entry) => entry.role)).toEqual([
    "user",
    "assistant",
  ]);
  expect(observed.filter((type) => type === "agent_end")).toHaveLength(2);
});

async function makeRuntime(
  extensions: readonly Extension[],
): Promise<HenaRuntime> {
  const runtime = await createRuntime({ extensions });
  runtimes.push(runtime);
  return runtime;
}

function providerScript(): Extension {
  return (api) => {
    api.provideProvider({
      stream: (request: ProviderRequest) =>
        chunkStream(providerChunks(request)),
    });
  };
}

function providerChunks(request: ProviderRequest): readonly ProviderChunk[] {
  if (shouldCallTool(request)) {
    return [
      {
        toolCall: {
          id: "increment_1",
          input: { value: 41 },
          name: "increment",
        },
        type: "tool_call",
      },
      { stopReason: "completed", type: "finish" },
    ];
  }
  return [
    {
      text: `observed ${request.messages.length} messages`,
      type: "text_delta",
    },
    { stopReason: "completed", type: "finish" },
  ];
}

function shouldCallTool(request: ProviderRequest): boolean {
  const first = request.messages[0];
  return (
    request.messages.length === 1 &&
    first?.role === "user" &&
    first.content === "increment"
  );
}

function incrementTool(): Extension {
  return (api) => {
    api.registerTool({
      description: "Adds one to a number.",
      execute: (input) => ({
        text: String(readValue(input) + 1),
        type: "text",
      }),
      name: "increment",
      parameters: { type: "object" },
    });
  };
}

function eventRecorder(observed: Array<string>): Extension {
  return (api) => {
    api.on("event", (event) => {
      observed.push(event.type);
    });
  };
}

function chunkStream(
  chunks: readonly ProviderChunk[],
): AsyncIterable<ProviderChunk> {
  return makeChunkStream(chunks);
}

async function* makeChunkStream(chunks: readonly ProviderChunk[]) {
  await Promise.resolve();
  yield* chunks;
}

function readValue(input: unknown): number {
  if (hasNumericValue(input)) {
    return input.value;
  }
  return 0;
}

function hasNumericValue(input: unknown): input is { readonly value: number } {
  return (
    typeof input === "object" &&
    input !== null &&
    "value" in input &&
    typeof input.value === "number"
  );
}
