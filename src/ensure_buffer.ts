import { Buffer } from "buffer";
import { BSONTypeError } from "./error.ts";

/**
 * Makes sure that, if a Uint8Array is passed in, it is wrapped in a Buffer.
 *
 * @param potentialBuffer - The potential buffer
 * @returns Buffer the input if potentialBuffer is a buffer, or a buffer that
 * wraps a passed in Uint8Array
 * @throws BSONTypeError If anything other than a Buffer or Uint8Array is passed in
 */
export function ensureBuffer(
  potentialBuffer: Buffer | ArrayBufferView | ArrayBuffer,
): Buffer {
  if (ArrayBuffer.isView(potentialBuffer)) {
    return Buffer.from(
      potentialBuffer.buffer,
      potentialBuffer.byteOffset,
      potentialBuffer.byteLength,
    );
  }

  if (potentialBuffer instanceof ArrayBuffer) {
    return Buffer.from(potentialBuffer);
  }

  throw new BSONTypeError("Must use either Buffer or TypedArray");
}
