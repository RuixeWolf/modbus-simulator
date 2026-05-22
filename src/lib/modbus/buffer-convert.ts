export type DataType =
  | 'UIntBE'
  | 'UIntLE'
  | 'UInt8'
  | 'UInt16BE'
  | 'UInt16LE'
  | 'UInt32BE'
  | 'UInt32LE'
  | 'IntBE'
  | 'IntLE'
  | 'Int8'
  | 'Int16BE'
  | 'Int16LE'
  | 'Int32BE'
  | 'Int32LE'
  | 'FloatBE'
  | 'FloatLE'
  | 'Float1234'
  | 'Float2143'
  | 'Float3412'
  | 'Float4321'
  | 'DoubleBE'
  | 'DoubleLE'

/** Map each data type to its byte size. */
const TYPE_SIZES: Record<DataType, number> = {
  UInt8: 1,
  UInt16BE: 2,
  UInt16LE: 2,
  UInt32BE: 4,
  UInt32LE: 4,
  UIntBE: 4,
  UIntLE: 4,
  Int8: 1,
  Int16BE: 2,
  Int16LE: 2,
  Int32BE: 4,
  Int32LE: 4,
  IntBE: 4,
  IntLE: 4,
  FloatBE: 4,
  FloatLE: 4,
  Float1234: 4,
  Float2143: 4,
  Float3412: 4,
  Float4321: 4,
  DoubleBE: 8,
  DoubleLE: 8
}

/**
 * Return the byte size for a given data type.
 * @param dataType – One of the supported DataType values.
 * @returns Byte size (1, 2, 4, or 8).
 */
export function getDataTypeSize(dataType: DataType): number {
  return TYPE_SIZES[dataType]
}

/**
 * Convert a user-supplied numeric value into a Buffer using the specified data type.
 * @param dataType – Target data type encoding.
 * @param value    – Numeric value to encode.
 * @returns Buffer containing the encoded bytes.
 */
export function numberToBuffer(dataType: DataType, value: number): Buffer {
  const size = TYPE_SIZES[dataType]
  const buf = Buffer.alloc(size)

  switch (dataType) {
    // Unsigned integers
    case 'UInt8':
      buf.writeUInt8(value & 0xff, 0)
      break
    case 'UInt16BE':
      buf.writeUInt16BE(value & 0xffff, 0)
      break
    case 'UInt16LE':
      buf.writeUInt16LE(value & 0xffff, 0)
      break
    case 'UInt32BE':
      buf.writeUInt32BE(value >>> 0, 0)
      break
    case 'UInt32LE':
      buf.writeUInt32LE(value >>> 0, 0)
      break
    case 'UIntBE':
      buf.writeUInt32BE(value >>> 0, 0)
      break
    case 'UIntLE':
      buf.writeUInt32LE(value >>> 0, 0)
      break

    // Signed integers
    case 'Int8':
      buf.writeInt8(value, 0)
      break
    case 'Int16BE':
      buf.writeInt16BE(value, 0)
      break
    case 'Int16LE':
      buf.writeInt16LE(value, 0)
      break
    case 'Int32BE':
      buf.writeInt32BE(value, 0)
      break
    case 'Int32LE':
      buf.writeInt32LE(value, 0)
      break
    case 'IntBE':
      buf.writeInt32BE(value, 0)
      break
    case 'IntLE':
      buf.writeInt32LE(value, 0)
      break

    // Floats
    case 'FloatBE':
      buf.writeFloatBE(value, 0)
      break
    case 'FloatLE':
      buf.writeFloatLE(value, 0)
      break
    case 'Float1234':
      buf.writeFloatBE(value, 0)
      break
    case 'Float4321':
      buf.writeFloatLE(value, 0)
      break
    case 'Float2143': {
      const temp = Buffer.alloc(4)
      temp.writeFloatBE(value, 0)
      // [B0,B1,B2,B3] -> [B1,B0,B3,B2]
      buf[0] = temp[1]
      buf[1] = temp[0]
      buf[2] = temp[3]
      buf[3] = temp[2]
      break
    }
    case 'Float3412': {
      const temp = Buffer.alloc(4)
      temp.writeFloatBE(value, 0)
      // [B0,B1,B2,B3] -> [B2,B3,B0,B1]
      buf[0] = temp[2]
      buf[1] = temp[3]
      buf[2] = temp[0]
      buf[3] = temp[1]
      break
    }

    // Doubles
    case 'DoubleBE':
      buf.writeDoubleBE(value, 0)
      break
    case 'DoubleLE':
      buf.writeDoubleLE(value, 0)
      break

    default:
      throw new Error(`Unsupported data type: ${dataType}`)
  }

  return buf
}

/**
 * Parse a flexible hex string into a Buffer.
 * Supports: "0A 45 B1 30", "0a45b130", "0x0A 0x45", "0x0A,0x45"
 *
 * Rejects malformed input (non-hex characters, odd-length compact form,
 * or space-separated tokens that are not exactly 2 hex digits).
 * Returns an empty buffer for any invalid input.
 *
 * @param input – Hex string to parse.
 * @returns Buffer containing the parsed bytes, or an empty buffer on invalid input.
 */
export function parseHexString(input: string): Buffer {
  // Strip optional "0x" / "0X" prefixes and commas, normalize whitespace
  const cleaned = input.replace(/0x/gi, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim()

  if (!cleaned) {
    return Buffer.alloc(0)
  }

  // Reject any characters other than hex digits and spaces
  if (/[^0-9a-fA-F\s]/.test(cleaned)) {
    return Buffer.alloc(0)
  }

  if (cleaned.includes(' ')) {
    // Space-separated: each token must be exactly 2 hex digits
    const parts = cleaned.split(' ')
    if (parts.some((p) => p.length !== 2)) {
      return Buffer.alloc(0)
    }
    const bytes = parts.map((p) => parseInt(p, 16))
    return Buffer.from(bytes)
  }

  // Compact form: length must be even
  if (cleaned.length % 2 !== 0) {
    return Buffer.alloc(0)
  }

  const parts = cleaned.match(/.{1,2}/g) ?? []
  const bytes = parts.map((p) => parseInt(p, 16))
  return Buffer.from(bytes)
}
