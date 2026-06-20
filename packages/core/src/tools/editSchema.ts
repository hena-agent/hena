import { Schema } from "effect";

export const EditToolParameters = Schema.Struct({
  filePath: Schema.String.annotate({
    description: "The path to the file to edit",
  }),
  oldString: Schema.String.annotate({
    description: "The exact string to replace",
  }),
  newString: Schema.String.annotate({
    description: "The replacement string",
  }),
});

export type EditToolInput = (typeof EditToolParameters)["Type"];

export interface EditToolDetails {
  readonly path: string;
  readonly replacements: number;
  readonly bytes: number;
}
