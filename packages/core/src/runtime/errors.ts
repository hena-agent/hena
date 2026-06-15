import { Schema } from "effect";

export class MissingProvider extends Schema.TaggedErrorClass<MissingProvider>()(
  "MissingProvider",
  {},
) {}
