# 4. OCR

## What this is
OCR finds text in a picture. Detection proposes boxes. Recognition reads the text inside each box. A confidence score says how sure the recognizer is.

## Why Shelf uses it
The thing you remember is often a word in the screenshot. The box lets the wall light up that word instead of only ranking the card.

## How it works
RapidOCR runs an ONNX detection model and an ONNX recognition model on CPU through ONNX Runtime. Each result is a quadrilateral, a string, and a score. Shelf converts the box to a normalized rectangle (`x`, `y`, `w`, `h` from 0 to 1) so the browser can draw it on any thumbnail size. The joined text fills a Postgres `tsvector` for full-text search.

## What you build
`ocr.read_lines` and the highlight overlay in the Next.js card. A query term that appears in a line adds that line to `highlights`.

## Must-knows
- OCR is not the caption. It is the literal text. A photo of a door may have no lines.
- Low confidence lines are still stored. Ranking can prefer other signals when the text is garbage.
- ONNX Runtime is the engine. RapidOCR is the model wiring. You do not need Tesseract.

## Interview questions
- Why store boxes as fractions of the image instead of pixels?
- What fails if you search only the caption and throw away OCR?

## Self-check
Type a word you can see in a screenshot. The card should move forward and the line should be outlined.
