# 8. Hybrid search and ranking

## What this is
Hybrid search runs several rankers and merges them. Reciprocal rank fusion (RRF) scores an item by the sum of `1 / (k + rank)` across lists. A cross-encoder then reranks a short list by reading the query and the passage together.

## Why Shelf uses it
Full-text is exact and cheap. Text vectors catch paraphrases. CLIP catches pictures. None of them should be trusted alone. A weighted sum needs you to tune weights. RRF only needs ranks, so the scores do not have to live on the same scale.

## How it works
Shelf asks each signal for a ranked id list. RRF with k = 60 merges them. The top 12 passages go to a FastEmbed cross-encoder (`Xenova/ms-marco-MiniLM-L-6-v2`), which is slower and more accurate than the bi-encoder because it sees query and text at once. The wall animates into that order. Modes `text`, `text_vector`, `clip`, `hybrid`, and `hybrid_rerank` exist so the eval can ablate them.

## What you build
`search.reciprocal_rank_fusion` and `retrieve.search`.

## Must-knows
- RRF cannot invent a hit that no list returned.
- Rerank the top of the list, not the whole collection. Cross-encoders are too slow for every row.
- An ablation that turns one signal off tells you whether that signal is earning its cost.

## Interview questions
- Why is RRF easier to mix with CLIP and BM25 than a weighted score sum?
- Why not run the cross-encoder on every screenshot?

## Self-check
If full-text ranks an item 1 and CLIP does not return it, can RRF still surface it?
