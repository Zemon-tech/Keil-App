# Meeting Features API Documentation

Complete REST API reference for meeting history, sharing, and management endpoints.

---

## Base URL

```
http://localhost:3000/api/v1/meetings
```

All endpoints require authentication via `Authorization: Bearer $JWT_TOKEN` header.

---

## Endpoints

### 1. Get Meeting History

**GET** `/history`

Retrieve paginated list of meetings for the authenticated user.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 20 | Items per page (max 50) |
| `archived` | boolean | false | Filter by archive status |

#### Request

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/history?page=1&limit=20&archived=false"
```

#### Response (200 OK)

```json
{
  "data": {
    "recordings": [
      {
        "id": "uuid",
        "title": "Q4 Planning Meeting",
        "created_at": "2024-01-15T10:30:00Z",
        "audio_duration_seconds": 1823,
        "word_count": 2450,
        "speaker_count": 3,
        "language_detected": "en-IN",
        "is_archived": false,
        "thumbnail_url": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47
    }
  }
}
```

#### Error Responses

```json
// 401 Unauthorized
{ "error": "No authentication token provided" }

// 500 Internal Server Error
{ "error": "Database query failed" }
```

---

### 2. Get Meeting Details (Review)

**GET** `/{{recordingId}}/review`

Retrieve complete meeting details for the review dialog.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `recordingId` | UUID | ID of the meeting recording |

#### Request

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/abc123def456/review"
```

#### Response (200 OK)

```json
{
  "data": {
    "id": "abc123def456",
    "user_id": "user-uuid",
    "title": "Q4 Planning Meeting",
    "description": "Discussed Q4 roadmap and budget allocation",
    "created_at": "2024-01-15T10:30:00Z",
    "audio_duration_seconds": 1823,
    "audio_s3_key": "recordings/user-id/2024-01-15-meeting.webm",
    "word_count": 2450,
    "speaker_count": 3,
    "language_detected": "en-IN",
    "is_archived": false,
    "shared_with_motion": false,
    "motion_page_id": null,
    "transcript_text": "Full plain text transcript...",
    "transcript_diarized": {
      "entries": [
        {
          "speaker_id": "0",
          "start_time_seconds": "0.0",
          "end_time_seconds": "15.5",
          "transcript": "Good morning everyone, let's start the Q4 planning..."
        }
      ]
    },
    "transcription_status": "completed",
    "thumbnail_url": null
  }
}
```

#### Error Responses

```json
// 404 Not Found
{ "error": "Meeting not found" }

// 403 Forbidden - user doesn't own this recording
{ "error": "Unauthorized" }
```

---

### 3. Update Meeting Metadata

**PATCH** `/{{recordingId}}/metadata`

Update meeting title and description.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `recordingId` | UUID | ID of the meeting recording |

#### Request Body

```json
{
  "title": "Updated Meeting Title",
  "description": "Optional meeting notes and summary"
}
```

#### Request

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q4 Strategic Planning",
    "description": "Discussed roadmap, budget, and team structure"
  }' \
  "http://localhost:3000/api/v1/meetings/abc123def456/metadata"
```

#### Response (200 OK)

```json
{
  "data": {
    "id": "abc123def456",
    "title": "Q4 Strategic Planning",
    "description": "Discussed roadmap, budget, and team structure",
    "updated_at": "2024-01-15T11:45:00Z"
  }
}
```

#### Error Responses

```json
// 403 Forbidden
{ "error": "Unauthorized" }

// 400 Bad Request
{ "error": "Title is required" }
```

---

### 4. Archive/Unarchive Meeting

**PATCH** `/{{recordingId}}/archive`

Toggle archive status of a meeting.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `recordingId` | UUID | ID of the meeting recording |

#### Request

```bash
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/abc123def456/archive"
```

#### Response (200 OK)

```json
{
  "data": {
    "id": "abc123def456",
    "is_archived": true,
    "updated_at": "2024-01-15T11:46:00Z"
  }
}
```

---

### 5. Delete Meeting

**DELETE** `/{{recordingId}}`

Permanently delete a meeting recording and its audio file.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `recordingId` | UUID | ID of the meeting recording |

#### Request

```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/abc123def456"
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Meeting deleted"
}
```

#### Error Responses

```json
// 404 Not Found
{ "error": "Meeting not found" }

// 403 Forbidden
{ "error": "Unauthorized" }
```

---

### 6. Search Meetings

**GET** `/search/query`

Full-text search across meeting titles and transcripts.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query (minimum 1 character) |

#### Request

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/search/query?q=budget"
```

#### Response (200 OK)

```json
{
  "data": [
    {
      "id": "abc123def456",
      "title": "Budget Review - Q4",
      "created_at": "2024-01-15T10:30:00Z",
      "audio_duration_seconds": 1200,
      "word_count": 1500
    },
    {
      "id": "xyz789abc123",
      "title": "Financial Planning",
      "created_at": "2024-01-14T14:00:00Z",
      "audio_duration_seconds": 900,
      "word_count": 1200
    }
  ]
}
```

#### Error Responses

```json
// 400 Bad Request
{ "error": "Search query required" }

// 500 Internal Server Error
{ "error": "Search failed" }
```

---

### 7. Share Meeting to Motion

**POST** `/{{recordingId}}/share-motion`

Create a new Motion page from the meeting transcript.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `recordingId` | UUID | ID of the meeting recording |

#### Request

```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/abc123def456/share-motion"
```

#### Response (200 OK)

```json
{
  "data": {
    "id": "motion-page-uuid",
    "user_id": "user-uuid",
    "title": "Q4 Planning Meeting",
    "slug": "q4-planning-meeting",
    "content": "**Speaker A** [0.0s]\n\nGood morning everyone...\n\n---\n\n**Speaker B** [15.5s]\n\nThanks for joining...",
    "is_public": false,
    "created_at": "2024-01-15T11:47:00Z"
  },
  "message": "Transcript shared to Motion successfully"
}
```

#### Error Responses

```json
// 404 Not Found
{ "error": "Recording not found" }

// 403 Forbidden
{ "error": "Unauthorized" }

// 500 Internal Server Error
{ "error": "Failed to create Motion page" }
```

---

## Response Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid parameters |
| 401 | Unauthorized | Missing/invalid authentication |
| 403 | Forbidden | User doesn't own resource |
| 404 | Not Found | Resource doesn't exist |
| 500 | Internal Server Error | Server error |

---

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **History/Search**: 100 requests per minute
- **Get/Update**: 1000 requests per minute
- **Create/Delete**: 100 requests per minute

Rate limit headers included in response:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705329000
```

---

## Data Models

### Meeting Recording Object

```typescript
interface MeetingRecording {
  id: UUID;
  user_id: UUID;
  meeting_id: UUID | null;
  title: string;
  description: string | null;
  created_at: ISO8601;
  updated_at: ISO8601;
  
  // Audio metadata
  audio_s3_key: string;
  audio_duration_seconds: number;
  
  // Transcription
  transcription_status: "pending" | "processing" | "completed" | "failed";
  transcript_text: string | null;
  transcript_diarized: TranscriptDiarized | null;
  
  // Metadata
  language_detected: string;
  word_count: number;
  speaker_count: number;
  
  // Organization
  is_archived: boolean;
  thumbnail_url: string | null;
  
  // Motion integration
  shared_with_motion: boolean;
  motion_page_id: UUID | null;
}

interface TranscriptDiarized {
  entries: Array<{
    speaker_id: string;
    start_time_seconds: number;
    end_time_seconds: number;
    transcript: string;
  }>;
}
```

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "value"
  }
}
```

Common error codes:

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Access denied |
| `NOT_FOUND` | Resource doesn't exist |
| `INVALID_INPUT` | Bad request parameters |
| `DATABASE_ERROR` | Database operation failed |
| `S3_ERROR` | S3 storage error |

---

## Pagination

List endpoints support cursor-based pagination:

```bash
# Get first page
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/history?page=1&limit=20"

# Get next page
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/meetings/history?page=2&limit=20"
```

Response includes pagination info:

```json
{
  "data": {
    "recordings": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47,
      "hasMore": true
    }
  }
}
```

---

## Search Query Syntax

The search endpoint supports:

```
# Simple keyword
q=budget

# Phrase search
q="Q4 planning"

# Multiple terms (OR)
q=budget planning

# Full-text operators (PostgreSQL)
q=budget & planning  # AND
q=budget | planning  # OR
q=!budget            # NOT
```

---

## Examples

### Example 1: Get all meetings and display in sidebar

```typescript
const { data: response } = await api.get("/v1/meetings/history", {
  params: { page: 1, limit: 20 },
});

const meetings = response.data.recordings;
meetings.forEach((meeting) => {
  console.log(`${meeting.title} (${meeting.audio_duration_seconds}s)`);
});
```

### Example 2: Search and open specific meeting

```typescript
const { data: response } = await api.get("/v1/meetings/search/query", {
  params: { q: "project budget" },
});

const firstResult = response.data[0];
const { data: fullMeeting } = await api.get(
  `/v1/meetings/${firstResult.id}/review`
);
```

### Example 3: Update and share to Motion

```typescript
// Update metadata
await api.patch(`/v1/meetings/${meetingId}/metadata`, {
  title: "Q4 Strategic Review",
  description: "Key decisions and action items",
});

// Share to Motion
const { data: motionPage } = await api.post(
  `/v1/meetings/${meetingId}/share-motion`
);

// Redirect to Motion
window.location.href = `/motion/${motionPage.data.id}`;
```

---

## Authentication

Include the JWT token in Authorization header:

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token is obtained from login endpoint and typically stored in:
- localStorage (client-side)
- HttpOnly cookie (secure)

---

## Webhooks (Future)

Planned webhook events:

- `meeting.recorded` - Recording completed
- `meeting.transcribed` - Transcription finished
- `meeting.shared` - Shared to Motion
- `meeting.deleted` - Meeting deleted

---

## SDK Support

Official SDKs available for:

- **JavaScript/TypeScript**: `@keil/meetings-sdk`
- **Python**: `keil-meetings`
- **Go**: `github.com/keil/meetings-go`

---

## Support & Documentation

- API Status: https://status.keil.app
- Documentation: https://docs.keil.app/meetings
- Issue Tracker: https://github.com/Zemon-tech/Keil-App/issues
- Discord: https://discord.gg/keil

---

**Last Updated**: January 2024
**Version**: 1.0.0