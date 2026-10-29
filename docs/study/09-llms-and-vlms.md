# 9. LLMs and vision-language models

## What this is
A language model predicts the next token. Temperature near 0 is steadier. A context window is the maximum tokens it can read. Quantization stores weights with fewer bits so a small machine can run the model. A vision-language model also reads an image.

## Why Shelf uses it
OCR does not say what the screenshot is. A small vision model writes a caption and a kind. Ask does not call a text model. It quotes the retrieved OCR. Gemini's AI Studio free tier is an optional second caption provider. It is off unless you set `GEMINI_API_KEY`, because that call sends the image to Google.

## How it works
The default vision tag is `moondream:1.8b`, served by Ollama at `localhost:11434`. Shelf posts a vision chat to `/api/chat` with the image bytes. If that call fails, the scripted provider labels the screenshot from keywords. `llama3.2` is not installed, and nothing on the Ask path calls it. No paid cloud model is required.

## What you build
`providers.py`: scripted, Ollama, and Gemini. The default path never calls Gemini. `OLLAMA_VISION_MODEL` defaults to `moondream:1.8b`.

## Must-knows
- On this CPU (no NVIDIA GPU), a cold caption of `eval/golden/black.png` took about 17 seconds and returned "urn of black liquid with a gray base." The same call warm took about 0.7 seconds. Ollama unloads the model after a few idle minutes, so the next quiet screenshot pays the load again. The queue is why upload does not wait.
- The measured golden run used the scripted labeler: 4 of 8 kinds matched the hand labels. `moondream:1.8b` is installed now (about 1.7 GB). Rows already on the wall have not been reprocessed, so those captions are still the scripted ones.
- `ollama pull` for this tag stalled because the registry's IPv6 address timed out. Downloading the blobs over IPv4 and placing them in the local Ollama store finished it. A text prompt to this vision model loops. Use the chat API.
- Temperature does not make a model factual. Grounding does.
- "Free tier" still means the image leaves the machine. Opt in on purpose.

## Interview questions
- What is the difference between a bi-encoder and a model that answers in sentences?
- Why keep a scripted fallback?

## Self-check
Which environment variable turns Gemini on, and what leaves the laptop when it is set?
