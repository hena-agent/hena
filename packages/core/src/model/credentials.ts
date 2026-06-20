import * as PiAi from "@earendil-works/pi-ai";
import { Effect } from "effect";

import type { HenaModel } from "./types";

export interface CredentialSource {
  readonly apiKey?: string;
  readonly envKey?: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface CredentialResolverConfig {
  readonly env?: Readonly<Record<string, string>>;
  readonly providers?: Readonly<Record<string, CredentialSource>>;
}

export interface ApiKeyAndHeaders {
  readonly apiKey: string;
  readonly headers?: Record<string, string>;
}

export interface CredentialResolverShape {
  readonly getApiKeyAndHeaders: (
    model: HenaModel,
  ) => Effect.Effect<ApiKeyAndHeaders | undefined>;
}

const configuredHeaders = (
  sourceHeaders: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined => {
  const headers = { ...sourceHeaders };
  return Object.keys(headers).length === 0 ? undefined : headers;
};

const configuredApiKey = (
  env: Readonly<Record<string, string>> | undefined,
  source: CredentialSource | undefined,
  provider: string,
): string | undefined => {
  if (source?.apiKey !== undefined) {
    return source.apiKey;
  }
  if (source?.envKey !== undefined) {
    return env?.[source.envKey];
  }
  return PiAi.getEnvApiKey(provider, env);
};

const withHeaders = (
  apiKey: string,
  headers: Record<string, string> | undefined,
): ApiKeyAndHeaders =>
  headers === undefined ? { apiKey } : { apiKey, headers };

export const makeCredentialResolver = (
  config: CredentialResolverConfig = {},
): CredentialResolverShape => ({
  getApiKeyAndHeaders: (
    model: HenaModel,
  ): Effect.Effect<ApiKeyAndHeaders | undefined> =>
    Effect.sync(() => {
      const source = config.providers?.[model.provider];
      const apiKey = configuredApiKey(config.env, source, model.provider);
      if (apiKey === undefined) {
        return undefined;
      }
      return withHeaders(apiKey, configuredHeaders(source?.headers));
    }),
});
