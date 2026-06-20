import { Effect } from "effect";

import { snapshotModel } from "./customModel";
import { DefaultModelNotFoundError, ModelNotFoundError } from "./errors";
import type * as ModelTypes from "./types";

const missingModel = (ref: ModelTypes.ModelRef): ModelNotFoundError =>
  new ModelNotFoundError({ provider: ref.provider, modelId: ref.modelId });

export const requireModel = (
  model: ModelTypes.HenaModel | undefined,
  ref: ModelTypes.ModelRef,
): Effect.Effect<ModelTypes.HenaModel, ModelNotFoundError> =>
  model === undefined
    ? Effect.fail(missingModel(ref))
    : Effect.succeed(snapshotModel(model));

export const requireDefaultModel = (
  model: ModelTypes.HenaModel | undefined,
): Effect.Effect<ModelTypes.HenaModel, DefaultModelNotFoundError> =>
  model === undefined
    ? Effect.fail(
        new DefaultModelNotFoundError({
          message: "No default model configured and no models are available",
        }),
      )
    : Effect.succeed(snapshotModel(model));
