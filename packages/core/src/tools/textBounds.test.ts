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

it("does not synthesize replacement characters for truncated emoji", () => {
  const result = boundUtf8Text("😀", 3);

  assert.deepStrictEqual(result, { bytes: 4, text: "", truncated: true });
});

it("handles three-byte UTF-8 truncation boundaries", () => {
  const result = boundUtf8Text("€", 2);

  assert.deepStrictEqual(result, { bytes: 3, text: "", truncated: true });
});

it("returns empty text for zero and negative byte caps", () => {
  const result = boundUtf8Text("a", -1);

  assert.deepStrictEqual(result, { bytes: 1, text: "", truncated: true });
});

it("drops invalid leading bytes at a truncation boundary", () => {
  const result = decodeBoundedUtf8Bytes(new Uint8Array([0xff, 0x61]), 1);

  assert.deepStrictEqual(result, { bytes: 2, text: "", truncated: true });
});
