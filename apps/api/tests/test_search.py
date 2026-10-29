from shelf.search import reciprocal_rank_fusion


def test_shared_hit_ranks_first():
    fused = reciprocal_rank_fusion([["a", "b"], ["b", "c"]])
    assert fused[0][0] == "b"
