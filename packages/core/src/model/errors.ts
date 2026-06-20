import { Schema } from "effect";

export class ModelNotFoundError extends Schema.TaggedErrorClass<ModelNotFoundError>()(
  "ModelNotFound",
  { provider: Schema.String, modelId: Schema.String },
) {}
