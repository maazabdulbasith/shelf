# 17. Cloud

## What this is
Shelf Sync, later, would sync an encrypted shelf between your phone and your laptop. The design names a real shape on AWS, Azure, and GCP. Terraform can describe it. Version one validates the Terraform and does not apply it. Nothing is billed.

## Why Shelf uses it
Job descriptions ask for cloud. You can show the design and a validated plan without a credit card. Applying it would create resources that cost money. That is out of scope.

## How it works
The laptop keeps the searchable copy. A phone upload would put ciphertext in object storage, a pointer in managed Postgres with pgvector, and a job on a queue. Keys live in a secret store. The server stores ciphertext, not a new copy of the readable image, if sync is end-to-end encrypted. Search of the plaintext still happens on a device that holds the key, or you have given up end-to-end encryption. The Terraform under `infra/terraform` describes a small GCP-shaped stack and is checked with `terraform validate`. It is never applied.

## What you build
`docs/sync-design.md` and `infra/terraform`.

## Must-knows
- Validate does not create resources. Apply does. Do not apply.
- End-to-end encryption and server-side semantic search fight each other. Say which one you are choosing.
- Managed pgvector exists on more than one cloud. The design should say what changes and what stays.

## Interview questions
- Where would you put the image bytes, the vectors, and the API?
- What does Terraform validate check, and what does it not check?

## Self-check
Say the command that proves the Terraform is syntactically valid, and say why you stop there.
