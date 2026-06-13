import { Effect } from "effect";
import { errorFromUnknown } from "./common";
import { isStandardSchema, type StandardResult, type Tool } from "./tools";

export type Validation =
  | { readonly input: unknown; readonly type: "valid" }
  | { readonly message: string; readonly type: "invalid" };

export function validateInput(
  tool: Tool,
  input: unknown,
): Effect.Effect<Validation> {
  const parameters = tool.parameters;
  if (!isStandardSchema(parameters)) {
    return Effect.succeed({ input, type: "valid" });
  }
  return Effect.map(
    Effect.tryPromise({
      catch: errorFromUnknown,
      try: async (): Promise<StandardResult> => {
        const result = await Promise.resolve(
          parameters["~standard"].validate(input),
        );
        return result;
      },
    }).pipe(Effect.catch((error) => Effect.succeed(toInvalid(error.message)))),
    (result) => validationFromStandard(result),
  );
}

function validationFromStandard(
  result: StandardResult | Validation,
): Validation {
  if ("type" in result) {
    return result;
  }
  if ("issues" in result) {
    return toInvalid(issueMessage(result));
  }
  return { input: result.value, type: "valid" };
}

function toInvalid(message: string): Validation {
  return { message, type: "invalid" };
}

function issueMessage(result: {
  readonly issues: readonly { readonly message?: string }[];
}): string {
  return result.issues[0]?.message ?? "Invalid tool input";
}
