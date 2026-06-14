import type { CoreEvent } from "../events";
import type { Extension } from "../extension";
import { createRuntime, type HenaRuntime } from "../runtime";
import type { AssistantPart, TranscriptEntry } from "../transcript";

const runtimes: Array<HenaRuntime> = [];

export async function disposeRuntimes(): Promise<void> {
  const disposals = runtimes.splice(0).map(async (runtime) => {
    await runtime.dispose();
  });
  await Promise.all(disposals);
}

export async function makeRuntime(
  extensions: ReadonlyArray<Extension>,
  options: { readonly maxTurns?: number } = {},
): Promise<HenaRuntime> {
  const runtime = await createRuntime({ ...options, extensions });
  runtimes.push(runtime);
  return runtime;
}

export async function collectUntilEnd(
  events: AsyncIterable<CoreEvent>,
): Promise<Array<CoreEvent>> {
  const collected: Array<CoreEvent> = [];
  for await (const event of events) {
    collected.push(event);
    if (event.type === "agent_end") {
      return collected;
    }
  }
  return collected;
}

export async function waitForEvent(
  events: AsyncIterable<CoreEvent>,
  type: CoreEvent["type"],
): Promise<CoreEvent> {
  for await (const event of events) {
    if (event.type === type) {
      return event;
    }
  }
  throw new Error(`Event ${type} was not emitted`);
}

export function eventTypes(
  events: ReadonlyArray<CoreEvent>,
): Array<CoreEvent["type"]> {
  return events.map((event) => event.type);
}

export function messageDeltas(events: ReadonlyArray<CoreEvent>): Array<string> {
  return events.flatMap((event) =>
    event.type === "message_delta" ? [event.text] : [],
  );
}

export function lastEvent(events: ReadonlyArray<CoreEvent>): CoreEvent {
  const last = events.at(-1);
  if (last === undefined) {
    throw new Error("Expected at least one event");
  }
  return last;
}

export function assistantParts(
  entry: TranscriptEntry | undefined,
): readonly AssistantPart[] {
  if (entry?.role !== "assistant") {
    throw new Error("Expected an assistant transcript entry");
  }
  return entry.parts;
}

export function mockEvent(sessionId: string): CoreEvent {
  return {
    schemaVersion: 1,
    sequence: 1,
    sessionId,
    timestamp: "2026-01-01T00:00:00.000Z",
    type: "agent_start",
  };
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("Timed out waiting for events"));
        }, ms);
      }),
    ]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}
