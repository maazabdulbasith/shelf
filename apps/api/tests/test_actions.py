from shelf.actions import extract, validate


def test_command_link_and_address():
    actions = extract("docker compose up\nhttps://example.com/menu\n14 Maple Street")
    kinds = {item["kind"] for item in actions}
    assert "copy_command" in kinds
    assert "open_link" in kinds
    assert "open_map" in kinds


def test_unknown_action_is_dropped():
    assert validate([{"kind": "send_money", "value": "100"}]) == []
