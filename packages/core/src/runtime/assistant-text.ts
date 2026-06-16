import type { Prompt } from "effect/unstable/ai";

import type { ActiveTextPart, AssistantState } from "./assistant";

type TextPartFactory = (params: {
  readonly text: string;
}) => Prompt.TextPart | Prompt.ReasoningPart;

interface TextDeltaOptions {
  readonly state: AssistantState;
  readonly activeParts: Map<string, ActiveTextPart>;
  readonly id: string;
  readonly delta: string;
  readonly makePart: TextPartFactory;
}

export const startTextPart = (
  state: AssistantState,
  activeParts: Map<string, ActiveTextPart>,
  id: string,
  makePart: TextPartFactory,
): void => {
  activeParts.set(id, { index: state.content.length, text: "" });
  state.content.push(makePart({ text: "" }));
};

export const appendTextDelta = ({
  state,
  activeParts,
  id,
  delta,
  makePart,
}: TextDeltaOptions): void => {
  const active = activeParts.get(id);
  if (active === undefined) {
    activeParts.set(id, { index: state.content.length, text: delta });
    state.content.push(makePart({ text: delta }));
    return;
  }

  const next = { ...active, text: `${active.text}${delta}` };
  activeParts.set(id, next);
  state.content[next.index] = makePart({ text: next.text });
};
