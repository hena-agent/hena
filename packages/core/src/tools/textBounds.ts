const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface BoundedUtf8Text {
  readonly bytes: number;
  readonly text: string;
  readonly truncated: boolean;
}

const decodePrefix = (encoded: Uint8Array, maxBytes: number): string => {
  let end = Math.max(0, Math.min(encoded.byteLength, maxBytes));

  while (end > 0) {
    const text = decoder.decode(encoded.slice(0, end));
    if (encoder.encode(text).byteLength <= maxBytes) {
      return text;
    }
    end -= 1;
  }

  return "";
};

export const boundUtf8Text = (
  text: string,
  maxBytes: number,
): BoundedUtf8Text => {
  const encoded = encoder.encode(text);
  const bytes = encoded.byteLength;

  return bytes <= maxBytes
    ? { bytes, text, truncated: false }
    : { bytes, text: decodePrefix(encoded, maxBytes), truncated: true };
};

export const decodeBoundedUtf8Bytes = (
  bytes: Uint8Array,
  maxBytes: number,
): BoundedUtf8Text => {
  const truncated = bytes.byteLength > maxBytes;
  return {
    bytes: bytes.byteLength,
    text: truncated ? decodePrefix(bytes, maxBytes) : decoder.decode(bytes),
    truncated,
  };
};
