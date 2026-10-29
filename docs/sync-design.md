# Shelf Sync

Version one of Shelf runs on one laptop. The index is the thing that becomes valuable: months of screenshots, already OCR'd and embedded. Sync is how a second device joins that index. A shared team shelf is the later step for support or design screenshots. Neither is built here, and nothing is billed.

## What has to be true first

- The local wall is good enough that you miss it on your phone.
- You can say, in one sentence, what is encrypted and what the server can read.
- A lost laptop can be restored from the sync copy, or you accept that it cannot.
- The golden-set gate is green on the build you would ship.

## The choice about encryption

End-to-end encryption means the server stores ciphertext and cannot embed the image. Search then runs on a device that holds the key. That is the design this document chooses. A server that embeds plaintext is easier, and it is a different product: the operator can read your screenshots. Shelf's selling point is that the default is private. Sync should not quietly give that up.

Practical shape:

1. The phone encrypts the image with a key that never goes to the server.
2. Object storage holds the ciphertext.
3. Managed Postgres holds the row id, the ciphertext pointer, and a device id. It does not hold a plaintext vector unless the device uploaded one it computed itself.
4. A queue tells the user's other devices "a new object exists."
5. The laptop downloads ciphertext, decrypts, and runs the same OCR and embedding pipeline it already runs for local files.
6. A secret store holds the wrapping key for server-side secrets (database password, storage credentials), not the user's content key.

The user's content key lives on the devices. A passphrase-derived key, or a key synced through the platform keychain, is the recovery story. Write that down before charging anyone.

## AWS

- S3 bucket for ciphertext, block public access, versioning on.
- RDS for PostgreSQL with the pgvector extension, private subnets.
- SQS for the "new object" events.
- Secrets Manager for the database password and the storage credentials.
- ECS or App Runner for a small API that authenticates a device and returns a presigned upload. The API never receives the image bytes in the clear.

## Azure

- Blob Storage with a private container.
- Azure Database for PostgreSQL Flexible Server with the pgvector extension.
- Storage queues or Service Bus for the notification.
- Key Vault for the server secrets.
- Container Apps for the same thin API.

## GCP

- Cloud Storage bucket, uniform access, public access prevented.
- Cloud SQL for PostgreSQL 16. Enable pgvector. Private IP.
- Pub/Sub for the notification.
- Secret Manager for the server secrets.
- Cloud Run for the thin API.

`infra/terraform` is the GCP shape, checked with `terraform validate` inside the HashiCorp Terraform 1.9 image. It is not applied. Apply would create a bucket, a Cloud SQL instance, and a secret, and those can cost money.

## What stays the same on every cloud

The laptop pipeline does not change: hash, OCR, caption, two embeddings, hybrid search, allowlisted actions, refusal. The cloud adds transport and storage. Ranking still happens where the plaintext and the vectors are, which in this design is the device.
