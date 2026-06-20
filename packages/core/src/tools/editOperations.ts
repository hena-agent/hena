import { Effect } from "effect";

import { ToolInputError } from "./toolErrors";

const countOccurrences = (content: string, search: string): number => {
  if (search === "") {
    return 0;
  }
  let count = 0;
  let index = 0;
  while (index < content.length) {
    const found = content.indexOf(search, index);
    if (found === -1) {
      return count;
    }
    count += 1;
    if (count > 1) {
      return count;
    }
    index = found + search.length;
  }
  return count;
};

export const editContent = (
  content: string,
  oldString: string,
  newString: string,
): Effect.Effect<
  { readonly content: string; readonly replacements: number },
  ToolInputError
> => {
  const occurrences = countOccurrences(content, oldString);
  if (occurrences === 0) {
    return Effect.fail(
      new ToolInputError({ message: "String to replace was not found." }),
    );
  }
  if (occurrences > 1) {
    return Effect.fail(
      new ToolInputError({
        message: "String to replace appears more than once.",
      }),
    );
  }
  return Effect.succeed({
    content: content.replace(oldString, () => newString),
    replacements: 1,
  });
};
