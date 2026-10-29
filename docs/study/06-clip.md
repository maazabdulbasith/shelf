# 6. CLIP and multimodal embeddings

## What this is
CLIP trains an image encoder and a text encoder so that a picture and a matching caption land in one vector space. You can search images with words.

## Why Shelf uses it
Some screenshots have no useful text: a door, a road, a chart. OCR returns nothing. CLIP can still rank a picture from a description.

## How it works
FastEmbed's CLIP ViT-B/32 pair is `Qdrant/clip-ViT-B-32-vision` for images and `Qdrant/clip-ViT-B-32-text` for queries. Both are 512 dimensions. Shelf stores the image vector at ingest and embeds the query text at search time. They only compare correctly because they share a space. CLIP is weak on tiny text, exact names, and screenshots that are mostly UI chrome.

## What you build
`embed.embed_image` and `embed.embed_clip_text`. Search mode `clip` uses only this signal. The golden set includes solid color fields so this path can be measured without your private photos.

## Must-knows
- Do not embed the query with the vision model, or the caption with the text embedding model, and expect CLIP search to work.
- 512 CLIP numbers are not 384 bge numbers. They live in different columns.
- A high CLIP score means visual similarity, not that the words in the query appear in the image.

## Interview questions
- Why does CLIP need two models?
- Give a query where OCR should beat CLIP, and one where CLIP should win.

## Self-check
Which model embeds the PNG, and which model embeds the search box text for a picture with no words?
