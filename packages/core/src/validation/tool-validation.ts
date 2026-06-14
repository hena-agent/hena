export type Validation =
  | { readonly input: unknown; readonly type: "valid" }
  | { readonly message: string; readonly type: "invalid" };
