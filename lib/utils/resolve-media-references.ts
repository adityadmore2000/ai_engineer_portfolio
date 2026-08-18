import { MARKDOWN_ASSET_IMAGE_PATTERN } from '@/lib/utils/media-ref';

export function resolveMediaReferences(
  markdown: string,
  mediaAssets: Array<{ refId: string; url?: string; alt?: string }>,
): string {
  return markdown.replace(
    MARKDOWN_ASSET_IMAGE_PATTERN,
    (_match, altText, refId) => {
      const asset = mediaAssets.find((a) => a.refId === refId);
      if (!asset?.url) return `![${altText || '⚠ missing'}](#)`;
      return `![${altText || asset.alt || ''}](${asset.url})`;
    },
  );
}
