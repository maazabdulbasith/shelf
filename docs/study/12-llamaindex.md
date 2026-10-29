# 12. LlamaIndex

## What this is
LlamaIndex is a library for retrieval-augmented generation. A document is split into nodes. A retriever returns nodes. A query engine calls the retriever and a synthesizer that writes an answer. Citations are the nodes that were used.

## Why Shelf uses it
Ask mode is a question, not a keyword. The useful abstraction is "retrieve, then answer from those nodes, and show which screenshots they were." LlamaIndex names those pieces. Shelf keeps its own retriever because the ranking already lives in pgvector.

## How it works
`Shelf` builds documents from the hybrid hits and a `VectorStoreIndex` only as the query-engine shell. The answer text comes from `answer_from_evidence`, which quotes the screenshot and returns citation ids. On this Windows machine, SQLAlchemy's compiled module can be blocked by Application Control. The fix is `DISABLE_SQLALCHEMY_CEXT=1` and `pip install --no-binary sqlalchemy`. Then `import llama_index.core` works. If it still fails, the same grounded function answers and records `engine: grounded`.

## What you build
`ask.llamaindex_answer`.

## Must-knows
- A query engine is not more grounded because it is a framework. Grounding is your rule: only talk about retrieved text.
- Mock embeddings in a unit test do not measure recall. The golden set does.
- Citations must be ids the UI can turn into thumbnails.

## Interview questions
- What is the difference between a retriever and a query engine?
- Why would you replace LlamaIndex's default vector store?

## Self-check
What do you install, and with which flag, when SQLAlchemy's DLL is blocked?
