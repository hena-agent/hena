import {
  type CoreEvent,
  createRuntime,
  type Extension,
  type HenaRuntime,
  type Session,
} from "../packages/core/src/core";

export type E2EHarness = {
  readonly close: () => Promise<void>;
  readonly url: string;
};

type Sessions = Map<string, Session>;

type PromptBody = {
  readonly input: string;
};

const encoder = new TextEncoder();

export async function createE2EHarness(
  extensions: readonly Extension[],
): Promise<E2EHarness> {
  const runtime = await createRuntime({ extensions });
  const sessions: Sessions = new Map();
  const server = Bun.serve({
    fetch: async (request: Request): Promise<Response> => {
      const response = await routeRequest(request, runtime, sessions);
      return response;
    },
    hostname: "127.0.0.1",
    port: 0,
  });
  return {
    close: async (): Promise<void> => {
      await server.stop(true);
      await runtime.dispose();
    },
    url: `http://127.0.0.1:${server.port}`,
  };
}

function routeRequest(
  request: Request,
  runtime: HenaRuntime,
  sessions: Sessions,
): Promise<Response> | Response {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  if (
    request.method === "POST" &&
    parts.length === 1 &&
    parts[0] === "sessions"
  ) {
    return createSessionResponse(runtime, sessions);
  }
  if (parts.length === 3 && parts[0] === "sessions") {
    return sessionAction(
      request,
      sessions,
      parts.slice(1, 2).join(""),
      parts.slice(2, 3).join(""),
    );
  }
  return json({ error: "not_found" }, 404);
}

function createSessionResponse(
  runtime: HenaRuntime,
  sessions: Sessions,
): Response {
  const session = runtime.createSession();
  sessions.set(session.id, session);
  return json({ id: session.id }, 201);
}

function sessionAction(
  request: Request,
  sessions: Sessions,
  id: string,
  action: string,
): Promise<Response> | Response {
  const session = sessions.get(id);
  if (session === undefined) {
    return json({ error: "session_not_found" }, 404);
  }
  if (request.method === "GET" && action === "events") {
    return eventResponse(session);
  }
  if (request.method === "POST" && action === "prompt") {
    return promptResponse(request, session);
  }
  return json({ error: "not_found" }, 404);
}

async function promptResponse(
  request: Request,
  session: Session,
): Promise<Response> {
  const body: unknown = await request.json();
  if (!isPromptBody(body)) {
    return json({ error: "invalid_prompt" }, 400);
  }
  await session.prompt(body.input);
  return json({ ok: true }, 200);
}

function eventResponse(session: Session): Response {
  const stream = new ReadableStream<Uint8Array>({
    start: (controller: ReadableStreamDefaultController<Uint8Array>): void => {
      void writeEvents(session.events, controller);
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream" },
    status: 200,
  });
}

async function writeEvents(
  events: AsyncIterable<CoreEvent>,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  for await (const event of events) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    if (event.type === "agent_end") {
      controller.close();
      return;
    }
  }
}

function json(body: object, status: number): Response {
  return Response.json(body, { status });
}

function isPromptBody(value: unknown): value is PromptBody {
  return isRecord(value) && typeof value.input === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
