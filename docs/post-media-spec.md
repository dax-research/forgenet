# Post System & Media Upload Specifications

## Post Text Validation

- **Character Limit**: Maximum 3,000 characters per post.
- **Enforcement**:
  - Backend is the source of truth (`post.model.js` schema validation and `post.controller.js` checks).
  - Submissions exceeding 3,000 characters or containing empty content return HTTP `400 Bad Request`.
  - Frontend (`PostComposer.jsx`) provides real-time character counting (`0 / 3000`) and client-side guards before network submission.

---

## Media Upload Architecture

Uploads are decoupled using a provider pattern (`services/storage/`):
```text
Client (PostComposer)
   │ (multipart/form-data)
   ▼
uploadPostImages Middleware (Multer memoryStorage)
   │ (Buffer, MIME & Size validation)
   ▼
Post Controller (createPost)
   │
   ▼
Storage Service (uploadMediaFiles)
   │
   ▼
Storage Provider (LocalStorageProvider / Future CloudinaryProvider)
   │
   ▼
Database (Post Schema with media & images array)
```

### Storage Providers
- **LocalStorageProvider**: Saves files to `public/uploads/` with collision-resistant hashed filenames (`Date.now()-[hash].[ext]`) and serves them statically via `/uploads/*` with CORS/Helmet compliance.
- **Provider Interface**:
  - `save(file)`: returns `{ filename, url, size, mimeType }`
  - `delete(filename)`: deletes file from storage

---

## Current Media Limits & Validation

| Parameter | Specification | Status |
|---|---|---|
| Max Images per Post | 20 images | Implemented |
| Max Image Size | 5 MB each | Implemented |
| Supported Image Types | `image/jpeg`, `image/png`, `image/webp` | Implemented |
| Video Uploads | Up to 100 MB, max 2 minutes | Planned (Future) |
| Document Uploads | Up to 100 MB | Planned (Future) |
| Multiple Reactions | Heart, celebrate, insight, etc. | Planned (Future) |
| Mentions & Hashtags | `@username`, `#hashtag` parser | Planned (Future) |
| Reposts | Share / Repost with quote | Planned (Future) |
| Visibility Controls | Public / Followers / Community | Planned (Future) |
| Link Previews | OpenGraph scraping & display | Planned (Future) |
| Alt Text Editor | Accessible image alt descriptions | Planned (Future) |

---

## API Endpoints

### 1. `POST /api/v1/posts`
- **Auth**: Required (`Bearer <jwt>`)
- **Content Types Supported**:
  - `application/json` (text-only posts and code snippets):
    ```json
    {
      "content": "Hello World",
      "codeBlocks": [{ "language": "javascript", "code": "console.log('hi');" }],
      "tags": ["react", "node"]
    }
    ```
  - `multipart/form-data` (posts with image attachments):
    - `content`: string (max 3,000 chars)
    - `images`: file[] (up to 20 files, max 5 MB each, JPG/PNG/WEBP)
    - `codeBlocks`: JSON string array
    - `tags`: JSON string array
- **Responses**:
  - `201 Created`: Returns created post document.
  - `400 Bad Request`: Validation failure (exceeded 3,000 chars, file > 5 MB, >20 files, or unsupported MIME type).
  - `401 Unauthorized`: Missing or invalid token.

### 2. `PUT /api/v1/posts/:id`
- **Auth**: Required (author only)
- **Validation**: Cannot exceed 3,000 characters; author ownership strictly validated (`403 Forbidden` if not owner).
