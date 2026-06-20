import * as PiAi from "@earendil-works/pi-ai";
import { Effect } from "effect";

import { snapshotModel, toModel } from "./customModel";
import { requireDefaultModel, requireModel } from "./resolveModel";
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
): ReadonlyArray<ModelTypes.HenaModel> => {
  const models = new Map<string, ModelTypes.HenaModel>();
  for (const builtIn of PiAi.getProviders()
    .flatMap((provider) => PiAi.getModels(provider))
    .filter((model) => accepts(config, model))) {
    models.set(`${builtIn.provider}\0${builtIn.id}`, snapshotModel(builtIn));
  }
  for (const model of (config.customModels ?? []).map(toModel)) {
    models.set(`${model.provider}\0${model.id}`, model);
  }
  return Array.from(models.values());
};

const findModel = (
  models: ReadonlyArray<ModelTypes.HenaModel>,
  ref: ModelTypes.ModelRef,
): ModelTypes.HenaModel | undefined =>
  models.find(
    (model) => model.provider === ref.provider && model.id === ref.modelId,
  );

export const makeModelRegistry = (
  config: ModelTypes.ModelRegistryConfig = {},
): Effect.Effect<ModelTypes.ModelRegistryShape> =>
  Effect.sync(() => {
    const models = listModels(config);
    const defaultRef =
      config.default === undefined ? undefined : { ...config.default };
    const workspaceDefaults = Object.fromEntries(
      Object.entries(config.workspaceDefaults ?? {}).map(([id, ref]) => [
        id,
        { ...ref },
      ]),
    );
    return {
      getModels: (provider?: string) =>
        Effect.succeed(
          provider === undefined
            ? models.map(snapshotModel)
            : models
                .filter((model) => model.provider === provider)
                .map(snapshotModel),
        ),
      getModel: (ref: ModelTypes.ModelRef) =>
        requireModel(findModel(models, ref), ref),
      getDefaultModel: (workspaceID?: string) => {
        const ref =
          workspaceID === undefined
            ? defaultRef
            : (workspaceDefaults[workspaceID] ?? defaultRef);
        if (ref !== undefined) {
          return requireModel(findModel(models, ref), ref);
        }
        return requireDefaultModel(models[0]);
      },
    } satisfies ModelTypes.ModelRegistryShape;
  });
