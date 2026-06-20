import { Context, type Path as EffectPath, Layer } from "effect";

export interface ToolWorkspaceConfig {
  readonly cwd: string;
}

export class ToolWorkspace extends Context.Service<
  ToolWorkspace,
  ToolWorkspaceConfig
>()("@hena-dev/core/ToolWorkspace") {
  static layer(config: ToolWorkspaceConfig): Layer.Layer<ToolWorkspace> {
    return Layer.succeed(ToolWorkspace)(config);
  }
}

export const resolvePath = (
  pathService: EffectPath.Path,
  cwd: string,
  path?: string,
): string => {
  const target = path ?? cwd;
  if (pathService.isAbsolute(target)) {
    return pathService.normalize(target);
  }
  return pathService.resolve(cwd, target);
};
