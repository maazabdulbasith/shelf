import hashlib


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
