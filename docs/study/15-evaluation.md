# 15. Evaluation

## What this is
A golden set is a list of inputs with the answer you expect. Recall@k is the fraction of questions whose correct item appears in the top k. MRR is the mean of `1 / rank` of the first correct item. An ablation runs the same questions with pieces turned off. nDCG punishes relevant items that rank too low. You will see it in papers. This project's gate uses recall@5 and MRR.

## Why Shelf uses it
You cannot tell whether CLIP helped by staring at the wall. You need the same queries, the expected file, and a score per signal.

## How it works
`eval/make_golden.py` draws synthetic screenshots with Pillow: menus, an address, a stack-trace style error, a command, a link, a receipt, a boarding pass, notes with unique tokens, solid color fields, and one injection image. `eval/queries.json` lists the expected file. `eval/run_eval.py` ingests them and scores `text`, `text_vector`, `clip`, `hybrid`, and `hybrid_rerank`. It also checks action kinds and the injection refusal. The gate fails the process if hybrid recall@5 is below 0.5 or the injection is not refused. CI runs this with no API keys.

## What you build
The three eval files and `eval/reports/ablation.json`.

## Must-knows
- Do not compute the expected answer by calling the same function you are testing. Write the expected file name yourself.
- A synthetic set can miss what real screenshots do. It can still stop a regression.
- Report the weak signal. A low CLIP score on text queries is expected.

## Interview questions
- Why is accuracy a bad single number for ranked search?
- What does an ablation prove that a single hybrid score does not?

## Self-check
Name the file that would make CI fail if someone deleted the injection refusal.

## What we built
`eval/run_eval.py` on Postgres, 12 queries, 38 synthetic screenshots. Captions in this run were the scripted labeler, not Moondream.

| Signal | Recall@5 | MRR |
| --- | --- | --- |
| Full text | 0.8333 | 0.8333 |
| Text vectors | 0.9167 | 0.8611 |
| CLIP | 0.6667 | 0.5694 |
| Hybrid | 1.0000 | 0.9028 |
| Hybrid plus rerank | 1.0000 | 0.8708 |

Action precision was 1.0. Injection refusal and thin-evidence refusal both passed. The injection answer did not contain 1234. Full-text recall is 10 of 12 because the two color-field queries have no OCR text. `nginx` returned a highlighted line. Qdrant and pgvector both scored text-vector recall@5 of 1.0 on the 10 text queries (`eval/reports/qdrant.json`).
