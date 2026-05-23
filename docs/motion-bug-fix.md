yeh plan banaya hai maine bhaiya



## 📚 Implementation Guide – Meetings Feature  
*Light‑weight, scalable, and reusable for future extensions.*

---

### 1️⃣ Overview
The **Meetings** module enables users to:

1. **Upload** meeting audio recordings directly from the client to an S3 bucket (via a presigned **PUT** URL).  
2. **Kick‑off** a Sarvam Speech‑to‑Text (STT) job that streams the audio from S3 to Sarvam’s Azure storage, starts transcription, and stores the result back in the database.  
3. **Poll** the job status, download the final transcript, and expose it via API endpoints.  

All logic lives in `backend/src/controllers/meeting.controller.ts` and is orchestrated by the service layer (`meeting.service.ts`).  

> **Goal:** Keep the service stateless, rely on managed services (Supabase/PostgreSQL, S3, Sarvam), and make it horizontally scalable (multiple Node / TS instances behind a load‑balancer).

---

### 2️⃣ High‑Level Data Flow

```
[Client] ──► GET /api/v1/meetings/upload‑url
   │                               │
   │          (presigned PUT)     │
   │◄─────────────────────────────│
   │                               │
   │  PUT audio file to S3          │
   │──────────────────────────────►│
   │                               │
   │  POST /api/v1/meetings/transcribe
   │  (sends recordingId, s3Key)   │
   │──────────────────────────────►│
   │                               │
   │  ► Generate presigned GET (S3) │
   │  ► Call Sarvam → create job    │
   │  ► Stream audio → Sarvam upload│
   │  ► Start job                  │
   │  ► Store sarvamJobId in DB     │
   │                               │
   │  GET /api/v1/meetings/status?jobId=…&recordingId=…
   │◄─────────────────────────────│
   │  (poll until “Completed”)      │
   │                               │
   │  GET results from Sarvam, store transcript
   │  → return final JSON payload  │
```

---

### 3️⃣ API Endpoints (express router)

| Method | Path | Description | Body / Query |
|--------|------|-------------|--------------|
| `GET` | `/api/v1/meetings/upload-url` | Returns a **presigned PUT** URL and S3 key. | `{ meetingId?, fileName?, contentType? }` |
| `POST`| `/api/v1/meetings/transcribe` | Starts a Sarvam transcription job. | `{ recordingId, s3Key, durationSeconds?, contentType? }` |
| `GET` | `/api/v1/meetings/status` | Checks job status and fetches transcript when done. | `?jobId=&recordingId=` |
| `GET` | `/api/v1/meetings/:meetingId/recordings` | List all recordings linked to a meeting. | – |

All routes are wrapped with `catchAsync` and return a consistent `ApiResponse` payload.

---

### 4️⃣ Core Implementation Details

#### 4.1 Presigned **PUT** URL (`getUploadUrl`)
* **Validate** the authenticated user (JWT middleware).  
* **Sanitize** the MIME type (`audio/webm` default).  
* **Build** an S3 key: `meetings/{userId}/{meetingId || 'general'}/{timestamp}-{safeFileName}`.  
* **Create** a `PutObjectCommand` and call `getSignedUrl` (expires in 1 h).  
* **Persist** a `recording` row with status **pending** (via `meetingService.createRecording`).  

#### 4.2 Transcribe (`transcribeRecording`)
1. **Validate** user and params.  
2. **Generate** a presigned **GET** URL for the uploaded audio.  
3. **Create** a Sarvam STT job (`POST /speech-to-text/job/v1`).  
4. **Request** Azure‑style upload URLs from Sarvam for the audio file.  
5. **Stream** the audio directly from S3 → Sarvom using the obtained URL (no local download).  
6. **Start** the job (`POST …/job/v1/{jobId}/start`).  
7. **Update** DB with `sarvamJobId` and `durationSeconds`.  

#### 4.3 Status & Result (`getTranscriptionStatus`)
* **GET** job status from Sarvam (`/job/v1/{jobId}/status`).  
* **When Completed:**  
  * Request result download URLs.  
  * Pull the JSON transcript, extract `transcript`, optional `diarized_transcript`, and `language_code`.  
  * **Persist** the final transcript & mark recording `completed`.  
* **When Failed:** mark recording `failed`.  
* **When In‑Progress:** return the current state (`accepted`, `pending`, `running`).  

#### 4.4 Recording Retrieval (`getMeetingRecordings`)
* Simple read‑only query to `meetingService.getRecordingsByMeetingId`.  

---

### 5️⃣ Database Schema (Supabase / PostgreSQL)

| Table | Columns (essential) |
|-------|---------------------|
| `recordings` | `id PK`, `user_id FK`, `meeting_id FK (nullable)`, `s3_key`, `sarvam_job_id`, `status` (`pending|processing|completed|failed`), `transcript TEXT`, `diarized JSONB`, `language VARCHAR`, `created_at`, `updated_at` |
| `meetings` (optional) | `id PK`, `title`, `host_user_id`, `start_time`, `end_time`, … |

> **Tip:** Use Supabase’s Row‑Level Security (RLS) policies so a user can only read/write their own recordings.

---

### 6️⃣ Scaling & Resilience

| Concern | Solution |
|---------|----------|
| **Stateless server** | No in‑memory state; all job IDs stored in DB. Horizontal scaling is safe. |
| **Large audio files** | Upload directly to S3 (client‑side) → reduces server bandwidth. |
| **Transient failures** | Wrap each external call (`fetch`, S3, Sarvam) in retries (exponential back‑off). |
| **Rate limits** | Cache Sarvam auth header (`api-subscription-key`) and respect the provider’s quota. |
| **Background processing** | For very long jobs, consider a **queue** (e.g., Supabase Functions or BullMQ) that periodically checks status instead of polling from the client. |
| **Observability** | Add structured logs (timestamp, requestId) and expose a Prometheus endpoint for metrics (`job_start`, `job_success`, `job_failure`). |
| **Security** | - `Content-Type` sanitization. <br> - Use **least‑privilege IAM** for S3 (only `putObject` on the specific bucket/prefix). <br> - Keep `SUPABASE_SECRET_KEY` and `SEVALLA_S3` credentials out of the repo (env only). |

---

### 7️⃣ Testing Checklist

1. **Unit tests** for each controller (mock `getSignedUrl`, `fetch`).  
2. **Integration test**:  
   * POST `/upload-url` → verify returned S3 key format.  
   * Simulate a small audio file upload to the signed URL (use `aws-sdk` S3 client).  
   * POST `/transcribe` → mock Sarvam responses (`createJob`, `uploadUrls`, `start`).  
   * Poll `/status` until `completed` → assert transcript stored.  
3. **E2E test** (cypress/playwright) covering the whole client flow.  

---

### 8️⃣ Future‑Proof Enhancements

| Feature | Why | Rough Implementation |
|---------|-----|----------------------|
| **WebHook callback** from Sarvam | Remove polling, get real‑time status. | Register a webhook endpoint, store `jobId → callbackUrl`. |
| **Chunked uploads** (large files) | Support > 500 MB recordings. | Use S3 multipart upload + client‑side chunking library. |
| **Audio format conversion** | Accept any audio codec. | Add a lightweight FFmpeg Lambda (or Supabase Edge Function) to convert to `webm`. |
| **Live transcription** | Near‑real‑time captions. | Stream audio chunks to Sarvam’s streaming endpoint instead of full‑file upload. |
| **Analytics dashboard** | Show speaker‑wise timings, word‑clouds. | Store diarized data, build a small React component to visualise. |
| **Multi‑tenant isolation** | SaaS scenario. | Prefix S3 keys with `tenantId/` and add RLS policies per tenant. |

---

### 9️⃣ Quick‑Start Checklist (for a new dev)

1. **Configure env** – ensure backend `.env` contains:  
   * `SEVALLA_S3_BUCKET_NAME`, `SEVALLA_S3_ENDPOINT`, `SEVALLA_S3_ACCESS_KEY_ID`, `SEVALLA_S3_SECRET_ACCESS_KEY`  
   * `SARVAM_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`  
2. **Run migrations** (if any) – Supabase UI → create `recordings` table as above.  
3. **Install dependencies** (already done):  
   ```bash
   cd backend && npm install
   ```
4. **Start dev servers**:  
   ```bash
   npm run dev   # backend
   npm run dev   # frontend (separate terminal)
   ```
5. **Test the flow** – use Postman or the UI to hit `/api/v1/meetings/upload-url`, upload a tiny `.webm` file, then call `/transcribe` and poll `/status`.  

---

### 🔧 TL;DR – What to Implement First

| Step | Description |
|------|-------------|
| **1** | Verify `getUploadUrl` creates a correctly‑scoped S3 key and persists a pending recording. |
| **2** | Ensure `transcribeRecording` can (a) fetch a presigned GET URL, (b) create a Sarvam job, (c) stream the audio to Sarvam, (d) store the job ID. |
| **3** | Implement `getTranscriptionStatus` to poll Sarvam, download the transcript, and update DB. |
| **4** | Add `getMeetingRecordings` for read‑only access. |
| **5** | Write unit tests for each controller and integration test for the whole pipeline. |
| **6** | Add basic logging & metrics; optionally replace polling with a webhook later. |

---

**You now have a compact, production‑ready blueprint for the Meetings feature that can be iterated on, scaled, and extended without major architectural changes.** 🚀
