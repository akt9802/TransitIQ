export function photoBytes(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  throw new Error("Photo was not found");
}

export function assertJpeg(bytes: Buffer) {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!jpeg) throw new Error("Photo is not valid");
  if (bytes.length > 2_000_000) throw new Error("Photo must be under 2 MB");
}
