import * as PiAi from "@earendil-works/pi-ai";
import { Effect } from "effect";

import { toModel } from "./customModel";
import { DefaultModelNotFoundError, ModelNotFoundError } from "./errors";
import type * as ModelTypes from "./types";

export { DefaultModelNotFoundError, ModelNotFoundError } from "./errors";
export type { CustomModelConfig } from "./types";

const accepts = (
  config: ModelTypes.ModelRegistryConfig,
  model: ModelTypes.HenaModel,
): boolean => {
  if (config.providers === undefined) {
    return true;
  }
  const filter = config.providers[model.provider];
  return filter?.models === undefined
    ? filter !== undefined
    : filter.models.includes(model.id);
};

const listModels = (
  config: ModelTypes.ModelRegistryConfig,
): ReadonlyArray<ModelTypes.HenaModel> => [
  ...PiAi.getProviders()
    .flatMap((provider) => PiAi.getModels(provider))
    .filter((model) => accepts(config, model)),
  ...(config.customModels ?? []).map(toModel),
];

const findModel = (
  models: ReadonlyArray<ModelTypes.HenaModel>,
  ref: ModelTypes.ModelRef,
): ModelTypes.HenaModel | undefined =>
  models.find(
    (model) => model.provider === ref.provider && model.id === ref.modelId,
  );

const missingModel = (ref: ModelTypes.ModelRef): ModelNotFoundError =>
  new ModelNotFoundError({ provider: ref.provider, modelId: ref.modelId });

const requireModel = (
  model: ModelTypes.HenaModel | undefined,
  ref: ModelTypes.ModelRef,
): Effect.Effect<ModelTypes.HenaModel, ModelNotFoundError> =>
  model === undefined ? Effect.fail(missingModel(ref)) : Effect.succeed(model);

const requireDefaultModel = (
  model: ModelTypes.HenaModel | undefined,
): Effect.Effect<ModelTypes.HenaModel, DefaultModelNotFoundError> =>
  model === undefined
    ? Effect.fail(
        new DefaultModelNotFoundError({
          message: "No default model configured and no models are available",
        }),
      )
    : Effect.succeed(model);

export const makeModelRegistry = (
  config: ModelTypes.ModelRegistryConfig = {},
): Effect.Effect<ModelTypes.ModelRegistryShape> =>
  Effect.sync(() => {
    const models = listModels(config);
    return {
      getModels: (provider?: string) =>
        Effect.succeed(
          provider === undefined
            ? models
            : models.filter((model) => model.provider === provider),
        ),
      getModel: (ref: ModelTypes.ModelRef) =>
        requireModel(findModel(models, ref), ref),
      getDefaultModel: (workspaceID?: string) => {
        const ref =
          workspaceID === undefined
            ? config.default
            : (config.workspaceDefaults?.[workspaceID] ?? config.default);
        if (ref !== undefined) {
          return requireModel(findModel(models, ref), ref);
        }
        return requireDefaultModel(models[0]);
      },
    } satisfies ModelTypes.ModelRegistryShape;
  });
