export function resolveMediaReferences(
  markdown: string,
  mediaAssets: Array<{ refId: string; url?: string; alt?: string }>,
): string {
  return markdown.replace(
    /!\[([^\]]*)\]\(asset:\/\/((?:img|vid)_[a-z0-9]{8})\)/g,
    (_match, altText, refId) => {
      const asset = mediaAssets.find((a) => a.refId === refId);
      if (!asset?.url) return `![${altText || '⚠ missing'}](#)`;
      return `![${altText || asset.alt || ''}](${asset.url})`;
    },
  );
}
