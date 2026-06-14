#!/usr/bin/env bun

/// <reference types="bun" />

import { createOpenAI } from "@ai-sdk/openai";
import {
  jsonSchema,
  streamText,
  tool as aiTool,
  type FinishReason,
  type LanguageModel,
  type ModelMessage as AiModelMessage,
  type ToolSet,
} from "ai";
import * as Schema from "effect/Schema";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import type { StopReason, TokenUsage } from "../packages/core/src/common/common";
import type { Extension } from "../packages/core/src/extensions/extension";
import type {
  ModelMessage as CoreModelMessage,
  ProviderChunk,
  ProviderRequest,
} from "../packages/core/src/provider/provider";
import { createRuntime } from "../packages/core/src/runtime/create-runtime";
import type { ToolDefinition, ToolParameters } from "../packages/core/src/tools/tools";

const CODEX_BASE_URL = "https://chatgpt.com/backend-api/codex";
const CODEX_MODEL = "gpt-5.4-mini";
const PROMPT =
  "Use the multiply tool to compute 12 * 13. Then answer with only the final equation.";

const multiplyInputSchema = Schema.Struct({
  left: Schema.Int.annotate({ description: "The left integer factor." }),
  right: Schema.Int.annotate({ description: "The right integer factor." }),
});
const multiplyParameters = Schema.toStandardSchemaV1(multiplyInputSchema);
const multiplyProviderSchema = Schema.toJsonSchemaDocument(
  multiplyInputSchema,
).schema as never;
type MultiplyInput = typeof multiplyInputSchema.Type;

async function main(): Promise<void> {
  await verifyEffectSchemaTool();
  const auth = await loadOpenAIOAuth();
  const runtime = await createRuntime({
    extensions: [codexProvider(auth), multiplyTool()],
    maxTurns: 4,
  });
  const session = runtime.createSession();

  try {
    const watch = watchEvents(session.events);
    console.log(`session: ${session.id}`);
    console.log(`model: ${CODEX_MODEL}`);
    console.log(`prompt: ${PROMPT}`);
    await session.prompt(PROMPT);
    const observed = await watch;
    const transcript = session.transcript();
    assertSmokeResult(observed, transcript);
    console.log("\ntranscript:");
    console.dir(transcript, { depth: null });
    console.log("\nverified: streamed text, tool_start, tool_end, and completed agent run");
  } finally {
    await runtime.dispose();
  }
}

function codexProvider(auth: OpenAIOAuth): Extension {
  return (api) => {
    const toolNamesByCallId = new Map<string, string>();
    const openai = createOpenAI({
      apiKey: auth.access,
      baseURL: CODEX_BASE_URL,
      fetch: codexFetch,
      headers: {
        "ChatGPT-Account-Id": auth.accountId,
        "OpenAI-Beta": "responses=experimental",
        "OpenAI-Originator": "codex_cli_rs",
        originator: "codex_cli_rs",
        session_id: crypto.randomUUID(),
      },
    });
    const model = openai.responses(CODEX_MODEL);
    api.provideProvider({
      stream: (request) =>
        aiSdkStream({ model, request, toolNamesByCallId }),
    });
  };
}

async function* aiSdkStream(options: {
  readonly model: LanguageModel;
  readonly request: ProviderRequest;
  readonly toolNamesByCallId: Map<string, string>;
}): AsyncIterable<ProviderChunk> {
  const tools = toAiToolSet(options.request.tools);
  const result = streamText({
    abortSignal: options.request.signal,
    messages: toAiMessages(options.request.messages, options.toolNamesByCallId),
    model: options.model,
    providerOptions: {
      openai: {
        instructions:
          "You are a concise assistant. Use available tools when requested, then answer only from the tool result.",
        store: false,
        strictJsonSchema: true,
      },
    },
    toolChoice: toolChoiceForSmoke(options.request, tools),
    tools,
  });

  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        yield { text: part.text, type: "text_delta" };
        break;
      case "tool-call":
        options.toolNamesByCallId.set(part.toolCallId, part.toolName);
        yield {
          toolCall: {
            id: part.toolCallId,
            input: part.input,
            name: part.toolName,
          },
          type: "tool_call",
        };
        break;
      case "finish":
        yield {
          stopReason: stopReasonFromFinish(part.finishReason),
          type: "finish",
          usage: usageFromAi(part.totalUsage),
        };
        break;
      case "abort":
        yield {
          error: { category: "aborted", message: part.reason ?? "Aborted" },
          stopReason: "aborted",
          type: "finish",
        };
        break;
      case "error":
        yield {
          error: { category: "unknown", message: messageFromUnknown(part.error) },
          stopReason: "error",
          type: "finish",
        };
        break;
      default:
        break;
    }
  }
}

function multiplyTool(): Extension {
  return (api) => {
    api.registerTool({
      description: "Multiply two integers and return the product.",
      execute: (input) => {
        const { left, right } = input as MultiplyInput;
        return { text: `${left} * ${right} = ${left * right}`, type: "text" };
      },
      name: "multiply",
      parameters: multiplyParameters,
      schema: multiplyProviderSchema,
    });
  };
}

async function verifyEffectSchemaTool(): Promise<void> {
  const valid = await multiplyParameters["~standard"].validate({
    left: 12,
    right: 13,
  });
  if ("issues" in valid) {
    throw new Error(
      `Effect Schema rejected valid input: ${valid.issues?.[0]?.message ?? "unknown"}`,
    );
  }
  const invalid = await multiplyParameters["~standard"].validate({
    left: "12",
    right: 13,
  });
  if (!("issues" in invalid)) {
    throw new Error("Effect Schema accepted invalid input");
  }
  console.log("effect-schema: validation ok");
}

function toAiToolSet(definitions: readonly ToolDefinition[]): ToolSet {
  const tools: ToolSet = {};
  for (const definition of definitions) {
    tools[definition.name] = aiTool({
      description: definition.description,
      inputSchema: inputSchemaForAi(definition.parameters),
    });
  }
  return tools;
}

function inputSchemaForAi(parameters: ToolParameters) {
  if (isEffectSchema(parameters)) {
    return jsonSchema(
      Schema.toJsonSchemaDocument(parameters as Schema.Top).schema as never,
    );
  }
  return jsonSchema(parameters as never);
}

function toolChoiceForSmoke(
  request: ProviderRequest,
  tools: ToolSet,
): "auto" | "none" | { readonly toolName: string; readonly type: "tool" } {
  const last = request.messages.at(-1);
  if (last?.role === "tool") {
    return "none";
  }
  if ("multiply" in tools) {
    return { toolName: "multiply", type: "tool" };
  }
  return "auto";
}

function toAiMessages(
  messages: readonly CoreModelMessage[],
  toolNamesByCallId: ReadonlyMap<string, string>,
): AiModelMessage[] {
  return messages.map((message) => toAiMessage(message, toolNamesByCallId));
}

function toAiMessage(
  message: CoreModelMessage,
  toolNamesByCallId: ReadonlyMap<string, string>,
): AiModelMessage {
  if (message.role === "user") {
    return { content: message.content, role: "user" };
  }
  if (message.role === "assistant") {
    return {
      content: message.parts.map((part) =>
        part.type === "text"
          ? { text: part.text, type: "text" as const }
          : {
              input: part.toolCall.input,
              toolCallId: part.toolCall.id,
              toolName: part.toolCall.name,
              type: "tool-call" as const,
            },
      ),
      role: "assistant",
    };
  }
  return {
    content: [
      {
        output: {
          type: message.isError ? "error-text" : "text",
          value: message.content,
        },
        toolCallId: message.toolCallId,
        toolName: toolNamesByCallId.get(message.toolCallId) ?? "multiply",
        type: "tool-result",
      },
    ],
    role: "tool",
  };
}

const codexFetch = Object.assign(
  async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const request = new Request(input, init);
    const next = await sanitizeRequest(request);
    const response = await fetch(next);
    if (!response.ok) {
      const body = await response.clone().text();
      console.error(`\nCodex HTTP ${response.status} ${response.statusText}`);
      console.error(body.slice(0, 4_000));
    }
    return response;
  },
  { preconnect: fetch.preconnect.bind(fetch) },
) satisfies typeof fetch;

async function sanitizeRequest(request: Request): Promise<Request> {
  if (request.method !== "POST") {
    return request;
  }
  const text = await request.clone().text();
  if (text.length === 0) {
    return request;
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return request;
  }
  if (!isRecord(body)) {
    return request;
  }
  const sanitized = sanitizeCodexBody(body);
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.set("content-type", "application/json");
  return new Request(request, {
    body: JSON.stringify(sanitized),
    headers,
  });
}

function sanitizeCodexBody(body: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...body, store: false };
  for (const key of unsupportedCodexKeys) {
    delete sanitized[key];
  }
  return sanitized;
}

const unsupportedCodexKeys = [
  "conversation",
  "max_output_tokens",
  "metadata",
  "previous_response_id",
  "prompt_cache_retention",
  "safety_identifier",
  "stream_options",
  "temperature",
  "top_p",
  "truncation",
  "user",
] as const;

async function watchEvents(events: AsyncIterable<unknown>): Promise<ObservedRun> {
  const observed: ObservedRun = {
    agentEnd: undefined,
    messageDeltaText: "",
    sawToolEnd: false,
    sawToolStart: false,
  };
  for await (const value of events) {
    const event = value as { readonly [key: string]: unknown; readonly type?: string };
    switch (event.type) {
      case "message_delta":
        observed.messageDeltaText += typeof event.text === "string" ? event.text : "";
        process.stdout.write(typeof event.text === "string" ? event.text : "");
        break;
      case "tool_start":
        observed.sawToolStart = true;
        console.log(`\n[event] tool_start ${toolNameFromEvent(event)}`);
        break;
      case "tool_end":
        observed.sawToolEnd = true;
        console.log(`[event] tool_end ${toolResultFromEvent(event)}`);
        break;
      case "agent_end":
        observed.agentEnd = typeof event.reason === "string" ? event.reason : undefined;
        console.log(`\n[event] agent_end ${observed.agentEnd ?? "unknown"}`);
        return observed;
      default:
        break;
    }
  }
  return observed;
}

function assertSmokeResult(
  observed: ObservedRun,
  transcript: readonly { readonly role: string }[],
): void {
  if (observed.agentEnd !== "completed") {
    throw new Error(`Expected completed run, got ${observed.agentEnd ?? "no agent_end"}`);
  }
  if (!observed.sawToolStart || !observed.sawToolEnd) {
    throw new Error("Expected multiply tool_start and tool_end events");
  }
  if (!transcript.some((entry) => entry.role === "tool_result")) {
    throw new Error("Expected a tool_result transcript entry");
  }
  if (!observed.messageDeltaText.trim()) {
    throw new Error("Expected streamed assistant text");
  }
}

function stopReasonFromFinish(reason: FinishReason): StopReason {
  if (reason === "error") {
    return "error";
  }
  return "completed";
}

function usageFromAi(usage: {
  readonly inputTokens: number | undefined;
  readonly outputTokens: number | undefined;
}): TokenUsage | undefined {
  if (usage.inputTokens === undefined || usage.outputTokens === undefined) {
    return undefined;
  }
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
  };
}

async function loadOpenAIOAuth(): Promise<OpenAIOAuth> {
  const path = join(homedir(), ".local/share/opencode/auth.json");
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isRecord(parsed) || !isRecord(parsed.openai)) {
    throw new Error(`Missing openai auth in ${path}`);
  }
  const auth = parsed.openai;
  if (auth.type !== "oauth") {
    throw new Error(`Expected opencode openai oauth auth, got ${String(auth.type)}`);
  }
  if (
    typeof auth.access !== "string" ||
    typeof auth.accountId !== "string" ||
    typeof auth.expires !== "number"
  ) {
    throw new Error(`Invalid openai oauth auth shape in ${path}`);
  }
  if (Date.now() >= auth.expires) {
    throw new Error(
      `OpenAI OAuth token expired at ${new Date(auth.expires).toISOString()}; re-login with opencode`,
    );
  }
  return {
    access: auth.access,
    accountId: auth.accountId,
    expires: auth.expires,
  };
}

function isEffectSchema(value: ToolParameters): boolean {
  return isRecord(value) && "ast" in value && "~standard" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageFromUnknown(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value);
}

function toolNameFromEvent(event: { readonly [key: string]: unknown }): string {
  const call = event.toolCall;
  if (isRecord(call) && typeof call.name === "string") {
    return call.name;
  }
  return "unknown";
}

function toolResultFromEvent(event: { readonly [key: string]: unknown }): string {
  const entry = event.entry;
  if (!isRecord(entry) || !isRecord(entry.content)) {
    return "unknown";
  }
  return typeof entry.content.text === "string" ? entry.content.text : "unknown";
}

type OpenAIOAuth = {
  readonly access: string;
  readonly accountId: string;
  readonly expires: number;
};

type ObservedRun = {
  agentEnd: string | undefined;
  messageDeltaText: string;
  sawToolEnd: boolean;
  sawToolStart: boolean;
};

await main();
