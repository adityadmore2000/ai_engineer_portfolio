export const ASSET_REF_PATTERN = /^(img|vid)_[a-z0-9]{8}$/;
export const ASSET_URI_PATTERN = /^asset:\/\/((?:img|vid)_[a-z0-9]{8})$/;
export const MARKDOWN_ASSET_IMAGE_PATTERN =
  /!\[([^\]]*)\]\(asset:\/\/((?:img|vid)_[a-z0-9]{8})\)/g;

export function generateMediaRefId(type: 'img' | 'vid' = 'img'): string {
  return `${type}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
}
