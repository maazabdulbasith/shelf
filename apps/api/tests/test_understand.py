from shelf.understand import run_understand


def test_long_ocr_skips_caption_and_still_extracts_command():
    result = run_understand(
        "nginx error upstream timed out while reading the response header from the upstream server",
        "unused.png",
        provider="scripted",
    )
    assert result["kind"] == "error"
    assert result["provider_used"] == "scripted"
    assert any(action["kind"] == "copy_text" or action["value"] for action in result["actions"])
