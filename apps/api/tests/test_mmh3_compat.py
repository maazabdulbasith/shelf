from shelf.mmh3_compat import hash as murmur


def test_matches_mmh3_hash_vectors():
    assert murmur("foo") == -156908512
    assert murmur("foo", 42) == -1322301282
    assert murmur("foo", signed=False) == 4138058784
    assert murmur(b"foo") == -156908512
