import { assert, it } from "@effect/vitest";

import { boundUtf8Text, decodeBoundedUtf8Bytes } from "./textBounds";

it("bounds text by UTF-8 bytes without returning partial code points", () => {
  const result = boundUtf8Text("aé", 2);

  assert.deepStrictEqual(result, { bytes: 3, text: "a", truncated: true });
  assert.strictEqual(
    new TextEncoder().encode(result.text).byteLength <= 2,
    true,
  );
});

it("decodes bounded UTF-8 bytes without returning partial code points", () => {
  const result = decodeBoundedUtf8Bytes(new TextEncoder().encode("aé"), 2);

  assert.deepStrictEqual(result, { bytes: 3, text: "a", truncated: true });
});

it("returns empty text when the cap cannot fit a complete code point", () => {
  const result = boundUtf8Text("é", 1);

  assert.deepStrictEqual(result, { bytes: 2, text: "", truncated: true });
});
