# 11. LangChain and LangGraph

## What this is
LangChain wraps chat models and tools. LangGraph is a state machine: nodes are functions, edges say what runs next, and a conditional edge picks a branch.

## Why Shelf uses it
Ingest is a pipeline with a branch. Long OCR does not need a caption model. A missing model must fall back. A graph makes that branch visible instead of a nest of if statements you cannot test.

## How it works
The state holds `ocr_text`, `image_path`, `provider`, and the fields the nodes fill in. The entry edge calls `_caption_needed`. Twelve or more words go straight to `extract`. Fewer words go to `caption`, which calls the provider, then to `extract`. `extract` always runs the deterministic action extractor and the allowlist. `langchain-ollama` is available for the chat model. The scripted provider is the fallback when no model is running.

## What you build
`understand.py`. `run_understand` invokes the compiled graph.

## Must-knows
- A node returns a partial state update. It should not hide a network call that the tests cannot stub.
- Conditional edges belong on data you already have, such as OCR length, not on hope.
- The graph does not get to skip the allowlist.

## Interview questions
- When is a graph clearer than a single function?
- What state would you log when a node fails?

## Self-check
A screenshot whose OCR is one short line should visit the caption node. A long error log should not need it. Say why.
