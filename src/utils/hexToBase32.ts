export const hexToBase32 = (unresolvedAddress: string) => {
  // hex to bytes
  const bytesArray = []
  for (let i = 0; i < unresolvedAddress.length; i += 2) {
    bytesArray.push(parseInt(unresolvedAddress.slice(i, i + 2), 16))
  }
  const uint8Array = new Uint8Array(bytesArray)

  // base32 encode
  const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

  let bits = 0
  let value = 0
  let base32 = ''

  for (let i = 0; i < uint8Array.length; i++) {
    value = (value << 8) | uint8Array[i]
    bits += 8

    while (bits >= 5) {
      base32 += base32Chars[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }

  if (bits > 0) {
    base32 += base32Chars[(value << (5 - bits)) & 0x1f]
  }

  return base32
}
