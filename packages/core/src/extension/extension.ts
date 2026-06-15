import { pathToFileURL } from "node:url";
import { Data, Effect, Exit, Ref, Scope } from "effect";

import type { CoreRuntime } from "../runtime/runtime";

export class InvalidExtensionModule extends Data.TaggedError(
  "InvalidExtensionModule",
)<Record<never, never>> {}

export type ExtensionFactory = (
  api: CoreRuntime,
) => Effect.Effect<void, unknown, Scope.Scope>;

type UnknownExtensionFactory = (api: CoreRuntime) => unknown;

interface UnknownExtensionModule {
  readonly default: UnknownExtensionFactory;
}

export interface LoadedExtension {
  readonly unload: Effect.Effect<void>;
}

const isExtensionModule = (value: unknown): value is UnknownExtensionModule =>
  typeof value === "object" &&
  value !== null &&
  "default" in value &&
  typeof value.default === "function";

const isExtensionEffect = (
  value: unknown,
): value is Effect.Effect<void, unknown, Scope.Scope> => Effect.isEffect(value);

const readFactory = (
  value: unknown,
): Effect.Effect<UnknownExtensionFactory, InvalidExtensionModule> =>
  isExtensionModule(value)
    ? Effect.succeed(value.default)
    : Effect.fail(new InvalidExtensionModule());

const loadFactory = (
  specifier: string,
): Effect.Effect<UnknownExtensionFactory, InvalidExtensionModule> =>
  Effect.tryPromise({
    catch: () => new InvalidExtensionModule(),
    try: async (): Promise<unknown> => {
      const module: unknown = await import(specifier);
      return module;
    },
  }).pipe(Effect.flatMap(readFactory));

export const loadExtension = Effect.fnUntraced(function* (
  api: CoreRuntime,
  revision: Ref.Ref<number>,
  path: string,
) {
  const count = yield* Ref.getAndUpdate(revision, (value) => value + 1);
  const specifier = `${pathToFileURL(path).href}?hena=${count}`;
  const factory = yield* loadFactory(specifier);
  const scope = yield* Scope.make();
  const effect = factory(api);
  if (!isExtensionEffect(effect)) {
    return yield* Effect.fail(new InvalidExtensionModule());
  }
  yield* effect.pipe(
    Effect.provideService(Scope.Scope, scope),
    Effect.mapError(() => new InvalidExtensionModule()),
  );
  return { unload: Scope.close(scope, Exit.void) };
});
