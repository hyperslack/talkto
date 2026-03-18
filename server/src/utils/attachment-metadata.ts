/**
 * Message attachment metadata utilities.
 *
 * Parse, validate, and format file attachment metadata
 * for message attachments in TalkTo.
 */

export interface AttachmentMeta {
  filename: string;
  extension: string;
  mimeType: string;
  category: AttachmentCategory;
  sizeBytes: number;
  sizeFormatted: string;
}

export type AttachmentCategory = "image" | "video" | "audio" | "document" | "code" | "archive" | "other";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".js": "text/javascript",
  ".ts": "text/typescript",
  ".py": "text/x-python",
  ".rs": "text/x-rust",
  ".go": "text/x-go",
};

const CATEGORY_MAP: Record<string, AttachmentCategory> = {
  "image/": "image",
  "video/": "video",
  "audio/": "audio",
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats": "document",
  "text/plain": "document",
  "text/markdown": "document",
  "text/csv": "document",
  "text/javascript": "code",
  "text/typescript": "code",
  "text/x-python": "code",
  "text/x-rust": "code",
  "text/x-go": "code",
  "application/json": "code",
  "application/zip": "archive",
  "application/x-tar": "archive",
  "application/gzip": "archive",
};

/** Get file extension from filename (lowercase, with dot). */
export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  if (dot === -1 || dot === filename.length - 1) return "";
  return filename.slice(dot).toLowerCase();
}

/** Guess MIME type from filename. */
export function guessMimeType(filename: string): string {
  const ext = getExtension(filename);
  return MIME_MAP[ext] ?? "application/octet-stream";
}

/** Categorize a MIME type. */
export function categorize(mimeType: string): AttachmentCategory {
  for (const [prefix, category] of Object.entries(CATEGORY_MAP)) {
    if (mimeType.startsWith(prefix)) return category;
  }
  return "other";
}

/** Format file size for display. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/** Build full attachment metadata from filename and size. */
export function buildMeta(filename: string, sizeBytes: number): AttachmentMeta {
  const extension = getExtension(filename);
  const mimeType = guessMimeType(filename);
  return {
    filename,
    extension,
    mimeType,
    category: categorize(mimeType),
    sizeBytes,
    sizeFormatted: formatSize(sizeBytes),
  };
}

/** Validate attachment against constraints. */
export function validateAttachment(
  filename: string,
  sizeBytes: number,
  maxSizeMb = 25,
  allowedCategories?: AttachmentCategory[]
): { valid: boolean; error?: string } {
  if (!filename || filename.trim().length === 0) {
    return { valid: false, error: "Filename is required" };
  }
  if (sizeBytes <= 0) {
    return { valid: false, error: "File size must be positive" };
  }
  if (sizeBytes > maxSizeMb * 1024 * 1024) {
    return { valid: false, error: `File exceeds ${maxSizeMb}MB limit` };
  }
  if (allowedCategories) {
    const meta = buildMeta(filename, sizeBytes);
    if (!allowedCategories.includes(meta.category)) {
      return { valid: false, error: `File type '${meta.category}' not allowed` };
    }
  }
  return { valid: true };
}

/** Check if a file is previewable in the browser. */
export function isPreviewable(filename: string): boolean {
  const meta = buildMeta(filename, 0);
  return meta.category === "image" || meta.category === "video" || meta.category === "audio";
}

/** Get an emoji icon for a file category. */
export function categoryIcon(category: AttachmentCategory): string {
  const icons: Record<AttachmentCategory, string> = {
    image: "🖼️",
    video: "🎬",
    audio: "🎵",
    document: "📄",
    code: "💻",
    archive: "📦",
    other: "📎",
  };
  return icons[category];
}
