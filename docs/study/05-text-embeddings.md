# 5. Text embeddings

## What this is
An embedding model maps text to a list of numbers. Similar meanings land nearer each other. Cosine similarity compares direction, which is why vectors are often normalized.

## Why Shelf uses it
"upstream timed out" and "nginx error" share meaning even when they share few exact words. Full-text search misses that. A vector catches it.

## How it works
FastEmbed runs `BAAI/bge-small-en-v1.5`, a 384-dimension English model, on ONNX. Shelf embeds the OCR text plus the caption. The vector is stored in a `vector(384)` column. A query is embedded with the same model and compared with cosine distance. The model id is stored on the row as `text_model`. If you change models, old vectors are not comparable, so you re-embed.

## What you build
`embed.embed_text` and the `text_embedding` column. Search mode `text_vector` uses only this signal.

## Must-knows
- Dimensions must match the column. 384 does not fit in a 512 column.
- Cosine cares about angle. A longer caption should not beat a short one just because the vector is longer, which is why cosine normalizes.
- Embeddings do not "understand" your private names unless those strings are in the text you embed.
- FastEmbed imports `mmh3` for sparse BM25 even when you only want the dense model. Application Control on this PC blocked that DLL, the same class of block as SQLAlchemy's C extension. `embed._install_mmh3` falls back to `mmh3_compat`, a pure-Python MurmurHash3. Search and Ask both embed the query, so a failed import is a 500. Listing shots does not embed, so the wall can still load.

## Interview questions
- Why can you not mix vectors from two different models in one index?
- What does cosine similarity return for two identical unit vectors?

## Self-check
Name the model, the dimension, and the column Shelf uses for text.
