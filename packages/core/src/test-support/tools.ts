import type { ToolOutput } from "../common";
import type { Extension, ExtensionAPI } from "../extension";
import type { StandardResult, ToolContext } from "../tools";
import { waitForAbort } from "./streams";

export function noopTool(): Extension {
  return (api: ExtensionAPI): void => {
    api.registerTool({
      description: "Returns a no-op result.",
      execute: () => ({ text: "ok", type: "text" }),
      name: "noop",
      parameters: { type: "object" },
    });
  };
}

export function doubleTool(): Extension {
  return (api: ExtensionAPI): void => {
    api.registerTool({
      description: "Doubles a numeric value.",
      execute: async (
        input: unknown,
        context: ToolContext,
      ): Promise<ToolOutput> => {
        await context.update({ text: "halfway", type: "text" });
        return { text: String(readValue(input) * 2), type: "text" };
      },
      name: "double",
      parameters: { type: "object" },
    });
  };
}

export function abortableTool(): Extension {
  return (api: ExtensionAPI): void => {
    api.registerTool({
      description: "Waits until the session is aborted.",
      execute: async (
        _input: unknown,
        context: ToolContext,
      ): Promise<ToolOutput> => {
        await waitForAbort(context.signal);
        return { text: "tool aborted", type: "text" };
      },
      name: "wait-for-abort",
      parameters: { type: "object" },
    });
  };
}

export function standardTools(): Extension {
  return (api: ExtensionAPI): void => {
    api.registerTool({
      description: "Triples a numeric value.",
      execute: (input: unknown): ToolOutput => ({
        text: String(readValue(input) * 3),
        type: "text",
      }),
      name: "triple",
      parameters: standardValueSchema,
      schema: valueToolSchema,
    });
    api.registerTool({
      description: "Has a validator that throws.",
      execute: () => ({ text: "unreachable", type: "text" }),
      name: "schema-boom",
      parameters: throwingStandardSchema,
      schema: emptyToolSchema,
    });
  };
}

export const valueToolSchema = {
  properties: { value: { type: "number" } },
  required: ["value"],
  type: "object",
} as const;

export const emptyToolSchema = { type: "object" } as const;

export const standardValueSchema = {
  "~standard": {
    validate: (input: unknown): StandardResult => {
      if (hasNumericValue(input)) {
        return { value: input };
      }
      if (hasFallbackFlag(input)) {
        return { issues: [{}] };
      }
      return { issues: [{ message: "value is required" }] };
    },
  },
};

const throwingStandardSchema = {
  "~standard": {
    validate: (): StandardResult => {
      throw new Error("schema exploded");
    },
  },
};

export function failingTool(): Extension {
  return (api: ExtensionAPI): void => {
    api.registerTool({
      description: "Throws for test coverage.",
      execute: () => {
        throw new Error("tool failed");
      },
      name: "boom",
      parameters: { type: "object" },
    });
  };
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

function hasFallbackFlag(input: unknown): input is { readonly fallback: true } {
  return (
    typeof input === "object" &&
    input !== null &&
    "fallback" in input &&
    input.fallback === true
  );
}
