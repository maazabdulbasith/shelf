from shelf.hashing import content_hash


def test_same_bytes_same_hash():
    assert content_hash(b"abc") == content_hash(b"abc")


def test_different_bytes_differ():
    assert content_hash(b"abc") != content_hash(b"abd")
