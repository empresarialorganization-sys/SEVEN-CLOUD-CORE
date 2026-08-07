# Persistent Vault

Vault metadata is global to the configured SEVEN workspace and can describe **any niche or project**. `niche`, `project`, and `tags` are ordinary metadata fields, not an allowlist.

Upload flow:
1. Extension captures/downloads asset bytes and computes SHA-256 locally.
2. `prepare-upload` checks authentication, size and deduplication.
3. Cloud Core returns a short-lived Supabase signed upload URL.
4. Extension sends bytes directly to private Storage.
5. `finalize` verifies the object exists and marks metadata `ready`.

MCP `seven_vault_fetch` returns image bytes inline as MCP image content when the image is under `SEVEN_MAX_INLINE_IMAGE_BYTES`. Larger images and non-image files receive a short-lived signed URL. This is the mechanism designed to remove repeated manual ChatGPT attachments.
