import { Effect } from "effect";
import { expect, test } from "vitest";
import type { Tool } from "./tools/tools";
import { validateInput } from "./validation/validate-input";
import { validateJsonSchema } from "./validation/validate-json-schema";

test("validates JSON-schema primitive and collection types", () => {
  expect(validateJsonSchema({}, "anything")).toBeUndefined();
  expect(validateJsonSchema({ type: "array" }, [])).toBeUndefined();
  expect(validateJsonSchema({ type: "array" }, {})).toBe("input must be array");
  expect(validateJsonSchema({ type: "integer" }, 1)).toBeUndefined();
  expect(validateJsonSchema({ type: "integer" }, 1.5)).toBe(
    "input must be integer",
  );
  expect(validateJsonSchema({ type: "number" }, 1)).toBeUndefined();
  expect(validateJsonSchema({ type: "number" }, Infinity)).toBe(
    "input must be number",
  );
  expect(validateJsonSchema({ type: "object" }, {})).toBeUndefined();
  expect(validateJsonSchema({ type: "object" }, [])).toBe(
    "input must be object",
  );
  expect(validateJsonSchema({ type: "null" }, null)).toBeUndefined();
  expect(validateJsonSchema({ type: "null" }, false)).toBe(
    "input must be null",
  );
  expect(validateJsonSchema({ type: "string" }, "ok")).toBeUndefined();
  expect(validateJsonSchema({ type: "string" }, 1)).toBe(
    "input must be string",
  );
});

test("validates JSON-schema enums and array items", () => {
  expect(validateJsonSchema({ enum: ["a", "b"] }, "a")).toBeUndefined();
  expect(validateJsonSchema({ enum: ["a", "b"] }, "c")).toBe(
    "input must be one of the allowed values",
  );
  expect(
    validateJsonSchema({ items: { type: "number" }, type: "array" }, [1, 2]),
  ).toBeUndefined();
  expect(
    validateJsonSchema({ items: { type: "number" }, type: "array" }, [1, "x"]),
  ).toBe("input[1] must be number");
  expect(
    validateJsonSchema({ items: { type: "number" } }, "ignored"),
  ).toBeUndefined();
});

test("validates JSON-schema object properties", () => {
  const schema = {
    additionalProperties: false,
    properties: {
      value: { type: "number" },
      label: { type: "string" },
    },
    required: ["value"],
    type: "object",
  } as const;

  expect(validateJsonSchema(schema, { label: "missing" })).toBe(
    "input.value is required",
  );
  expect(validateJsonSchema(schema, { value: "bad" })).toBe(
    "input.value must be number",
  );
  expect(validateJsonSchema(schema, { value: 1, extra: true })).toBe(
    "input.extra is not allowed",
  );
  expect(validateJsonSchema(schema, { value: 1 })).toBeUndefined();
  expect(validateJsonSchema({ required: [] }, {})).toBeUndefined();
  expect(validateJsonSchema({ required: ["value"] }, "bad")).toBe(
    "input must be object",
  );
});

test("uses JSON-schema validation from tool input validation", async () => {
  const tool: Tool = {
    description: "Requires a numeric value.",
    execute: () => ({ text: "unused", type: "text" }),
    name: "json-tool",
    parameters: {
      properties: { value: { type: "number" } },
      required: ["value"],
      type: "object",
    },
  };

  await expect(
    Effect.runPromise(validateInput(tool, { value: 1 })),
  ).resolves.toEqual({
    input: { value: 1 },
    type: "valid",
  });
  await expect(Effect.runPromise(validateInput(tool, {}))).resolves.toEqual({
    message: "input.value is required",
    type: "invalid",
  });
});
