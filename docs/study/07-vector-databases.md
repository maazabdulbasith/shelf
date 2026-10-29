# 7. Vector databases

## What this is
A vector index finds the nearest stored vectors without comparing the query to every row. HNSW is a graph of nearest neighbors. IVFFlat clusters rows and searches only some clusters. Both are approximate.

## Why Shelf uses it
Postgres already holds the screenshot row, the OCR, and the full-text column. pgvector adds the two vector columns in the same database, so one backup covers the product. Qdrant is an optional second index for a recall and latency comparison.

## How it works
`vector(384)` and `vector(512)` columns use HNSW indexes with `vector_cosine_ops`. The query operator `<=>` is cosine distance. A `WHERE` filter can run before or after the nearest-neighbor step. Filtering after a small HNSW result can hide good matches. Filtering first is safer when the filter is selective. Other names you will see in job posts: FAISS is a library, Chroma is a local database, Pinecone is hosted, Weaviate and Milvus are dedicated servers, Azure AI Search is a hosted search service. The idea is the same: store vectors, query neighbors, filter.

## What you build
`PostgresStore` in `store.py`, plus `eval/benchmark_qdrant.py` for the optional comparison.

## Must-knows
- Approximate indexes can miss a true neighbor. Measure recall. Do not assume the top hit is perfect.
- One database with two vector columns is easier to back up than a text database plus a separate vector service.
- The distance you index must be the distance you query.

## Interview questions
- When would you pick a dedicated vector database over pgvector?
- What is the difference between HNSW and a full scan?

## Self-check
Name the index type Shelf creates, the operator it queries with, and one product from a job description that does the same job.
