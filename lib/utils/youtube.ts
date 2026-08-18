export const YOUTUBE_PROTOCOL_PREFIX = 'youtube://';

export const YOUTUBE_BLOCK_PATTERN = /^!\[.*?\]\(youtube:\/\/([a-zA-Z0-9_-]{11})\)$/m;

const VIDEO_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/;

export function isValidYouTubeId(id: string): boolean {
  return VIDEO_ID_REGEX.test(id);
}

export function extractVideoId(url: string): string | null {
  try {
    // youtu.be/ID
    const shortMatch = url.match(/^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})(?:[?#]|$)/);
    if (shortMatch) return shortMatch[1];

    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, '');

    if (hostname !== 'youtube.com') return null;

    // youtube.com/watch?v=ID
    if (parsed.pathname === '/watch') {
      const id = parsed.searchParams.get('v');
      if (id && isValidYouTubeId(id)) return id;
      return null;
    }

    // youtube.com/shorts/ID
    const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})(?:\/|$)/);
    if (shortsMatch) return shortsMatch[1];

    return null;
  } catch {
    return null;
  }
}

export function getYouTubeThumbnailUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
}

export function getYouTubeEmbedUrl(id: string): string {
  return `https://www.youtube.com/embed/${id}`;
}
