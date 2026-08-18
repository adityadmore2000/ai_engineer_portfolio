export const ASSET_REF_PATTERN = /^(img|vid)_[a-z0-9]{8}$/;
export const ASSET_URI_PATTERN = /^asset:\/\/((?:img|vid)_[a-z0-9]{8})$/;
export const MARKDOWN_ASSET_IMAGE_PATTERN =
  /!\[([^\]]*)\]\(asset:\/\/((?:img|vid)_[a-z0-9]{8})\)/g;

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
] as const;

export const MAX_UPLOAD_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function generateMediaRefId(type: 'img' | 'vid' = 'img'): string {
  return `${type}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}
