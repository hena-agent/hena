const encoder = new TextEncoder();
const decoder = new TextDecoder();

const isContinuationByte = (byte: number): boolean => (byte & 0xc0) === 0x80;

const sequenceLength = (lead: number): number => {
  if (lead < 0x80) {
    return 1;
  }
  if ((lead & 0xe0) === 0xc0) {
    return 2;
  }
  if ((lead & 0xf0) === 0xe0) {
    return 3;
  }
  return (lead & 0xf8) === 0xf0 ? 4 : 0;
};

const safeUtf8End = (encoded: Uint8Array, end: number): number => {
  let start = end;
  while (start > 0) {
    const byte = encoded[start - 1];
    /* istanbul ignore if -- start/end bounds keep this index present. */
    if (byte === undefined || !isContinuationByte(byte)) {
      break;
    }
    start -= 1;
  }
  const leadIndex = start === end ? end - 1 : start - 1;
  const lead = encoded[leadIndex];
  if (lead === undefined) {
    return 0;
  }
  const length = sequenceLength(lead);
  return length > 0 && end - leadIndex >= length ? end : leadIndex;
};

export interface BoundedUtf8Text {
  readonly bytes: number;
  readonly text: string;
  readonly truncated: boolean;
}

const decodePrefix = (encoded: Uint8Array, maxBytes: number): string => {
  const end = safeUtf8End(
    encoded,
    Math.max(0, Math.min(encoded.byteLength, maxBytes)),
  );
  return end === 0 ? "" : decoder.decode(encoded.slice(0, end));
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
