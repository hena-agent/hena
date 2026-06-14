import { Effect } from "effect";
import { errorFromUnknown } from "../common/error-from-unknown";
import { isStandardSchema } from "../tools/is-standard-schema";
import type { StandardResult, Tool } from "../tools/tools";
import type { Validation } from "./tool-validation";
import { validateJsonSchema } from "./validate-json-schema";

export const validateInput = (
  tool: Tool,
  input: unknown,
): Effect.Effect<Validation> => {
  const toInvalid = (message: string): Validation => ({
    message,
    type: "invalid",
  });

  const issueMessage = (result: {
    readonly issues: readonly { readonly message?: string }[];
  }): string => result.issues[0]?.message ?? "Invalid tool input";

  const validationFromStandard = (result: StandardResult): Validation => {
    if ("issues" in result) {
      return toInvalid(issueMessage(result));
    }
    return { input: result.value, type: "valid" };
  };

  const parameters = tool.parameters;
  if (!isStandardSchema(parameters)) {
    const error = validateJsonSchema(parameters, input);
    return Effect.succeed(
      error === undefined ? { input, type: "valid" } : toInvalid(error),
    );
  }
  return Effect.tryPromise({
    catch: errorFromUnknown,
    try: async (): Promise<StandardResult> => {
      const result = await Promise.resolve(
        parameters["~standard"].validate(input),
      );
      return result;
    },
  }).pipe(
    Effect.map((result) => validationFromStandard(result)),
    Effect.catch((error) => Effect.succeed(toInvalid(error.message))),
  );
};
