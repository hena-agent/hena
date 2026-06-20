import { Type } from "@earendil-works/pi-ai";
import { JsonSchema, Schema } from "effect";

export type AgentToolParameters = ReturnType<(typeof Type)["Unsafe"]>;

const toJsonSchemaParameters = (schema: Schema.Top): JsonSchema.JsonSchema => {
  const document = JsonSchema.toDocumentDraft07(
    Schema.toJsonSchemaDocument(schema, { additionalProperties: false }),
  );

  return {
    $schema: JsonSchema.META_SCHEMA_URI_DRAFT_07,
    ...document.schema,
    definitions: document.definitions,
  };
};

export const toAgentToolParameters = (
  schema: Schema.Top,
): AgentToolParameters => Type.Unsafe(toJsonSchemaParameters(schema));
