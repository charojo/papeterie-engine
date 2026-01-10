# Client-Side Storage Strategy

## Context
The Papeterie Engine is being deployed to PythonAnywhere, which has strict disk space limits (typically 512MB-1GB). The current architecture stores all user assets (sprites, sounds, scenes) on the server filesystem (`/assets`). This is not sustainable for a multi-user or even single-heavy-user scenario on a constrained environment.

## Goal
Implement a **Client-Side Storage Mode** where:
1.  **Storage**: Sprites, Sounds, and Scene JSONs are stored in the user's browser (IndexedDB / OPFS).
2.  **Server Role**: The Python Backend becomes a stateless processor for heavy tasks (Background Removal, Metadata Generation) but does NOT persist the results.
3.  **Persistence**: The user's "Project" lives in their browser cache.

## Architecture Changes

### 1. Frontend: Asset Abstraction Layer
Currently, `Theatre.js` and `App.jsx` fetch assets via HTTP URLs (e.g., `/assets/sprites/foo/foo.png`).

We will introduce an `AssetRepository` interface:
```typescript
interface AssetRepository {
  getSpriteImage(name: string): Promise<string>; // Returns URL (http:// or blob:)
  getSpriteMetadata(name: string): Promise<JSON>;
  saveSprite(name: string, imageBlob: Blob, metadata: JSON): Promise<void>;
  listSprites(): Promise<Sprite[]>;
}
```

Implementations:
*   `ServerAssetRepository`: Existing behavior (wraps `fetch`).
*   `LocalAssetRepository`: Uses `idb` (IndexedDB Wrapper) to store/retrieve Blobs.

### 2. Backend: Stateless Processing Endpoints
We need new endpoints (or modifications to existing ones) that return the *result* of processing instead of saving it.

*   `POST /sprites/process`:
    *   Input: Image File + Prompt (optional)
    *   Action: `rembg` (remove background), `Gemini` (generate metadata).
    *   Output: JSON containing `{ "metadata": {...}, "processed_image": "<base64>" }` (or multipart response).
    *   **Crucial**: The server deletes temp files immediately.

### 3. Data Flow (Client Storage Mode)
1.  **User Upload**: User selects file in React.
2.  **Processing**: React sends file to `POST /sprites/process`.
3.  **Receive**: React receives cleaned image + metadata.
4.  **Store**: React saves cleaned image (Blob) and metadata to `IndexedDB`.
5.  **Render**: `Theatre.js` requests sprite 'foo'. `LocalAssetRepository` retrieves Blob from IDB, creates `URL.createObjectURL(blob)`, and returns it.

## Technical Implementation Details

### Browser Storage Limit
*   IndexedDB is suitable for significant amounts of data (can be GBs depending on device).
*   `idb-keyval` is a simple library, but for binary blobs, we might want a custom schema in raw `idb`.

### Stateless Backend Endpoints
*   Modify `src/server/routers/sprites.py`.
*   Add `dry_run=True` flag to upload endpoint? Or a dedicated `/process` endpoint. A dedicated endpoint is cleaner.

### Testing
*   Verify that no files remain in `/assets` or `/tmp` on server after processing.
*   Verify `blob:` URLs load correctly in Canvas (`Theatre.js`).

## Migration / Hybrid
*   The application config (`config.js`) determines the mode.
*   Eventually, we could support "Sync" (uploading local project to server/cloud storage like S3), but for PA "User Disk Space" (Client) is the priority.

## Plan
1.  **Prototype**: Create `LocalAssetRepository` using `idb`.
2.  **Backend**: Add `POST /processing/sprite` endpoint.
3.  **Frontend**: Update `App.jsx` to use `AssetRepository` based on config.
