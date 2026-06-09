# S3 Storage Architecture

This document outlines the security boundaries and design decisions behind the Keil App's multi-bucket S3 configuration.

---

## System Overview & Flow

The system segregates assets by security and accessibility requirements into **Private** and **Public** buckets.

```
                  ┌────────────────────────────────────────┐
                  │              User Client               │
                  └─────────┬────────────────────┬─────────┘
                            │                    │
        (Upload Private Asset)                  (Upload Public Asset)
        [Presigned PUT Flow]                     [Presigned PUT Flow]
                            │                    │
                            ▼                    ▼
             ┌──────────────────────┐    ┌──────────────────────┐
             │  Private S3 Bucket   │    │   Public S3 Bucket   │
             │                      │    │                      │
             │ - meetings/*         │    │ - profiles/*         │
             │ - chats/*            │    │ - motion-pages/*     │
             └──────────┬───────────┘    └──────────┬───────────┘
                        │                           │
              (Presigned GET Flow)             (Direct Public Read)
                        ▼                           ▼
             ┌──────────────────────┐    ┌──────────────────────┐
             │    Express Backend   │    │      User Client     │
             │  (Membership Check)  │    └──────────────────────┘
             └──────────────────────┘
```

---

## 1. Private Bucket Security Model
The private S3 bucket stores highly sensitive meeting recordings and chat attachments.

### AWS Security Configuration
* **Block All Public Access:** Enabled. All checkboxes under the "Block public access" settings must be checked.
* **Encryption:** Enabled default AWS KMS or S3-managed encryption (SSE-S3).
* **Object Ownership:** Bucket owner preferred.

### Access Flow
1. **Presigned Upload (PUT):**
   * Frontend requests an upload URL for a specific file name, content type, and context (e.g., channel ID or meeting ID).
   * Backend verifies user authentication and channel/meeting authorization.
   * Backend invokes S3 `PutObjectCommand` and returns a presigned PUT URL valid for 1 hour.
2. **Presigned Retrieval (GET):**
   * Frontend requests the resource (e.g., chat attachment).
   * Backend checks if the authenticated user has access (e.g., is a member of the corresponding chat channel).
   * If authorized, backend invokes S3 `GetObjectCommand` and returns a presigned GET URL valid for 15 minutes.

---

## 2. Public Bucket Model (Direct S3 URL Access)
The public S3 bucket stores user profile pictures (avatars) and motion page assets. To keep the MVP simple and fast to deploy, we bypass CDN routing and access public objects directly via regional S3 public links.

### AWS Security Configuration
* **Block All Public Access:** Disabled (to allow public read via bucket policy or objects).
* **CORS Settings:** Allowed origins must match the frontend domain (`http://localhost:5173` or your production domain).
* **Bucket Policy:** Allows anonymous `s3:GetObject` on all objects inside the bucket.

### Retrieval Flow
* Public assets are loaded directly from S3 using standard HTTPS URLs:
  `https://${bucketName}.s3.${region}.amazonaws.com/profiles/${userId}/avatar.png`

### Path Structures
* `profiles/${userId}/avatar-${timestamp}.png` — User avatars.
* `motion-pages/assets/${pageId}/${fileName}` — Static images and motion graphic assets.
