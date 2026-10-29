"""MurmurHash3 x86 32-bit, the function fastembed calls as mmh3.hash.

Windows Application Control blocks the mmh3 extension DLL in this venv.
fastembed only needs hash() for BM25, so this module stands in when the
native import fails.
"""


def _murmur3_32(data: bytes, seed: int) -> int:
    c1 = 0xCC9E2D51
    c2 = 0x1B873593
    length = len(data)
    hashed = seed & 0xFFFFFFFF
    blocks = length // 4
    for index in range(blocks):
        start = index * 4
        chunk = int.from_bytes(data[start : start + 4], "little")
        chunk = (chunk * c1) & 0xFFFFFFFF
        chunk = ((chunk << 15) | (chunk >> 17)) & 0xFFFFFFFF
        chunk = (chunk * c2) & 0xFFFFFFFF
        hashed ^= chunk
        hashed = ((hashed << 13) | (hashed >> 19)) & 0xFFFFFFFF
        hashed = (hashed * 5 + 0xE6546B64) & 0xFFFFFFFF
    tail = data[blocks * 4 :]
    chunk = 0
    if len(tail) >= 3:
        chunk ^= tail[2] << 16
    if len(tail) >= 2:
        chunk ^= tail[1] << 8
    if len(tail) >= 1:
        chunk ^= tail[0]
        chunk = (chunk * c1) & 0xFFFFFFFF
        chunk = ((chunk << 15) | (chunk >> 17)) & 0xFFFFFFFF
        chunk = (chunk * c2) & 0xFFFFFFFF
        hashed ^= chunk
    hashed ^= length
    hashed ^= hashed >> 16
    hashed = (hashed * 0x85EBCA6B) & 0xFFFFFFFF
    hashed ^= hashed >> 13
    hashed = (hashed * 0xC2B2AE35) & 0xFFFFFFFF
    hashed ^= hashed >> 16
    return hashed


def hash(key, seed: int = 0, signed: bool = True) -> int:
    if isinstance(key, str):
        key = key.encode("utf-8")
    elif isinstance(key, bytearray):
        key = bytes(key)
    value = _murmur3_32(key, seed)
    if signed and value & 0x80000000:
        return value - 0x100000000
    return value
