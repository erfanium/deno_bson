import { Buffer } from "buffer";
import { Binary, BinarySizes } from "../binary.ts";
import {
  BSONRegExp,
  BSONSymbol,
  Code,
  DBRef,
  Decimal128,
  Document,
  Double,
  Long,
  MaxKey,
  MinKey,
  ObjectId,
  Timestamp,
} from "../bson.ts";
import * as constants from "../constants.ts";
import { normalizedFunctionString } from "./utils.ts";

export function calculateObjectSize(
  object: Document,
  serializeFunctions?: boolean,
  ignoreUndefined?: boolean,
): number {
  let totalLength = 4 + 1;

  if (Array.isArray(object)) {
    for (let i = 0; i < object.length; i++) {
      totalLength += calculateElement(
        i.toString(),
        object[i],
        serializeFunctions,
        true,
        ignoreUndefined,
      );
    }
  } else {
    // If we have toBSON defined, override the current object

    if (object.toBSON) {
      object = object.toBSON();
    }

    // Calculate size
    for (const key in object) {
      totalLength += calculateElement(
        key,
        object[key],
        serializeFunctions,
        false,
        ignoreUndefined,
      );
    }
  }

  return totalLength;
}

function calculateElement(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  serializeFunctions = false,
  isArray = false,
  ignoreUndefined = false,
) {
  // If we have toBSON defined, override the current object
  if (value?.toBSON) {
    value = value.toBSON();
  }

  switch (typeof value) {
    case "string":
      return 1 + Buffer.byteLength(name, "utf8") + 1 + 4 +
        Buffer.byteLength(value, "utf8") + 1;
    case "number":
      if (
        Math.floor(value) === value &&
        value >= constants.JS_INT_MIN &&
        value <= constants.JS_INT_MAX
      ) {
        return value >= constants.BSON_INT32_MIN &&
            value <= constants.BSON_INT32_MAX
          ? (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
            (4 + 1)
          : (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
            (8 + 1);
      } else {
        // 64 bit
        return (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          (8 + 1);
      }
    case "undefined":
      if (isArray || !ignoreUndefined) {
        return (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) + 1;
      }
      return 0;
    case "boolean":
      return (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) + (1 + 1);
    case "object":
      if (value == null || value instanceof MinKey || value instanceof MaxKey) {
        return (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) + 1;
      } else if (value instanceof ObjectId) {
        return (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          (12 + 1);
      } else if (value instanceof Date) {
        return (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          (8 + 1);
      } else if (
        ArrayBuffer.isView(value) ||
        value instanceof ArrayBuffer
      ) {
        return (
          (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          (1 + 4 + 1) + value.byteLength
        );
      } else if (
        value instanceof Long || value instanceof Double ||
        value instanceof Timestamp
      ) {
        return (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          (8 + 1);
      } else if (value instanceof Decimal128) {
        return (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          (16 + 1);
      } else if (value instanceof Code) {
        // Calculate size depending on the availability of a scope
        if (value.scope != null && Object.keys(value.scope).length > 0) {
          return (
            (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
            1 +
            4 +
            4 +
            Buffer.byteLength(value.code.toString(), "utf8") +
            1 +
            calculateObjectSize(
              value.scope,
              serializeFunctions,
              ignoreUndefined,
            )
          );
        }
        return (
          (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          1 +
          4 +
          Buffer.byteLength(value.code.toString(), "utf8") +
          1
        );
      } else if (value instanceof Binary) {
        // Check what kind of subtype we have
        return value.sub_type === BinarySizes.SUBTYPE_BYTE_ARRAY
          ? (
            (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
            (value.position + 1 + 4 + 1 + 4)
          )
          : (
            (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
            (value.position + 1 + 4 + 1)
          );
      } else if (value instanceof BSONSymbol) {
        return (
          (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          Buffer.byteLength(value.value, "utf8") +
          4 +
          1 +
          1
        );
      } else if (value instanceof DBRef) {
        // Set up correct object for serialization
        const ordered_values = Object.assign(
          {
            $ref: value.collection,
            $id: value.oid,
          },
          value.fields,
        );

        // Add db reference if it exists
        if (value.db != null) {
          ordered_values.$db = value.db;
        }

        return (
          (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          1 +
          calculateObjectSize(
            ordered_values,
            serializeFunctions,
            ignoreUndefined,
          )
        );
      } else if (value instanceof RegExp) {
        return (
          (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          1 +
          Buffer.byteLength(value.source, "utf8") +
          1 +
          (value.global ? 1 : 0) +
          (value.ignoreCase ? 1 : 0) +
          (value.multiline ? 1 : 0) +
          1
        );
      } else if (value instanceof BSONRegExp) {
        return (
          (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          1 +
          Buffer.byteLength(value.pattern, "utf8") +
          1 +
          Buffer.byteLength(value.options, "utf8") +
          1
        );
      } else {
        return (
          (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          calculateObjectSize(value, serializeFunctions, ignoreUndefined) +
          1
        );
      }
    case "function":
      // WTF for 0.4.X where typeof /someregexp/ === 'function'
      if (
        value instanceof RegExp ||
        String.call(value) === "[object RegExp]"
      ) {
        return (
          (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
          1 +
          Buffer.byteLength(value.source, "utf8") +
          1 +
          (value.global ? 1 : 0) +
          (value.ignoreCase ? 1 : 0) +
          (value.multiline ? 1 : 0) +
          1
        );
      } else {
        if (
          serializeFunctions && value.scope != null &&
          Object.keys(value.scope).length > 0
        ) {
          return (
            (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
            1 +
            4 +
            4 +
            Buffer.byteLength(normalizedFunctionString(value), "utf8") +
            1 +
            calculateObjectSize(
              value.scope,
              serializeFunctions,
              ignoreUndefined,
            )
          );
        }
        if (serializeFunctions) {
          return (
            (name != null ? Buffer.byteLength(name, "utf8") + 1 : 0) +
            1 +
            4 +
            Buffer.byteLength(normalizedFunctionString(value), "utf8") +
            1
          );
        }
      }
  }

  return 0;
}
