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

const mergeHeaders = (
  modelHeaders: Readonly<Record<string, string>> | undefined,
  sourceHeaders: Readonly<Record<string, string>> | undefined,
): Record<string, string> | undefined => {
  const headers = { ...modelHeaders, ...sourceHeaders };
  return Object.keys(headers).length === 0 ? undefined : headers;
};

const configuredEnvKey = (
  env: Readonly<Record<string, string>> | undefined,
  source: CredentialSource | undefined,
): string | undefined =>
  source?.envKey === undefined ? undefined : env?.[source.envKey];

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
      const apiKey =
        source?.apiKey ??
        configuredEnvKey(config.env, source) ??
        PiAi.getEnvApiKey(model.provider, config.env);
      if (apiKey === undefined) {
        return undefined;
      }
      return withHeaders(apiKey, mergeHeaders(model.headers, source?.headers));
    }),
});
