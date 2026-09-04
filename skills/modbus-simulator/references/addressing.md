# Addressing and values

The control API always uses zero-based addresses.

| Human reference | API table           | API address |
| --------------- | ------------------- | ----------- |
| `00001`         | `coils`             | `0`         |
| `10001`         | `discrete-inputs`   | `0`         |
| `30001`         | `input-registers`   | `0`         |
| `40001`         | `holding-registers` | `0`         |

Subtract the table's human base from a reference; for example `40017` becomes holding-register address `16`.

Coils and discrete inputs accept only JSON booleans. Holding and input registers accept integer words from `0` through `65535`. Discrete inputs and input registers are read-only through Modbus protocol function codes, but the control API intentionally writes them as test fixtures.

Encoded writes preserve these data type names: `UIntBE`, `UIntLE`, `UInt8`, `UInt16BE`, `UInt16LE`, `UInt32BE`, `UInt32LE`, `IntBE`, `IntLE`, `Int8`, `Int16BE`, `Int16LE`, `Int32BE`, `Int32LE`, `FloatBE`, `FloatLE`, `Float1234`, `Float2143`, `Float3412`, `Float4321`, `DoubleBE`, and `DoubleLE`. Hex byte mode accepts an even number of bytes such as `12 34 AB CD` or `1234abcd`.
