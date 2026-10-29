# 13. RAG over screenshots

## What this is
Retrieval-augmented generation answers from retrieved evidence instead of from the model's memory. A citation says which evidence. A refusal is the correct answer when the evidence is missing or untrustworthy.

## Why Shelf uses it
The answer should be a screenshot you took, not a plausible sentence. If the shelf has nothing about the question, guessing a cafe that is not in your pictures is worse than saying so.

## How it works
Ask runs hybrid search, then `answer_from_evidence`. No hits, or empty text, returns `thin_evidence` and a refusal. A successful answer is a quote of the screenshot text, and the citations are the shot ids. The UI shows those thumbnails. LlamaIndex wraps that quote in a query-engine shell with a mock LLM, so the recorded engine is `llamaindex` when the import works and `grounded` when it does not. No text model writes the sentence.

## What you build
`POST /v1/ask` and the Ask drawer.

## Must-knows
- Retrieval can be right and the answer still wrong if the synthesizer ignores the nodes. Quote, or constrain, the text.
- "I don't know" is a successful behavior. Test it.
- Top-k that is too small misses context. Top-k that is too large dilutes it.

## Interview questions
- How do you test that an answer is grounded?
- What should the product do when two screenshots disagree?

## Self-check
Ask a question about a subject you have never screenshotted. The answer should refuse, with reason `thin_evidence`.
