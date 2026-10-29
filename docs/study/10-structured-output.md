# 10. Prompting and structured output

## What this is
A prompt is the instruction plus the evidence. Structured output asks the model for JSON that matches a schema. Pydantic parses it. If parsing fails, you retry once, then drop the model's guess and use a safe default.

## Why Shelf uses it
The wall needs a `kind`, a caption, and action suggestions. Free prose is hard to render. Invalid actions are dangerous if something executes them. Shelf never executes them. It still refuses shapes it did not ask for.

## How it works
The prompt says the allowed kinds and the allowed action names. The model reply is sliced from the first `{` to the last `}` and validated as `Understanding`. `suggested_actions` then pass through `actions.validate`, which keeps only `open_map`, `open_link`, `copy_text`, `copy_command`, `call`, and `add_to_calendar`. The prompt text is hashed. That hash is `prompt_version` on the row.

## What you build
`Understanding` in `providers.py` and `validate` in `actions.py`. Deterministic extractors also find URLs, phones, addresses, commands, and dates without a model.

## Must-knows
- Schema validation is not a safety policy. The allowlist is.
- Retry once. A second failure should not loop.
- The screenshot text is evidence inside the prompt, not a new system instruction. Say that in the prompt.

## Interview questions
- Why hash the prompt?
- What do you do when the model returns an action called `delete_file`?

## Self-check
List the six action kinds Shelf will keep.
