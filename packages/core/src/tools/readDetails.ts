export type ReadToolDetails =
  | {
      readonly path: string;
      readonly type: "file";
      readonly lineStart: number;
      readonly lineEnd: number;
      readonly totalLines: number;
      readonly truncated: boolean;
    }
  | {
      readonly path: string;
      readonly type: "directory";
      readonly entries: number;
      readonly truncated: boolean;
    };
