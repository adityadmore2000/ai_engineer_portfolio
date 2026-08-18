import ReactMarkdown from "react-markdown";
import { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkTextSize } from "@/lib/utils/remark-text-size";
import { YOUTUBE_PROTOCOL_PREFIX, isValidYouTubeId } from "@/lib/utils/youtube";
import { YouTubeEmbed } from "./YouTubeEmbed";
import { YouTubePreviewCard } from "./admin/common/YouTubePreviewCard";
import { resolveMediaReferences } from "@/lib/utils/resolve-media-references";

interface MarkdownProps {
  children?: string | null;
  className?: string;
  mediaAssets?: Array<{ refId: string; url?: string; alt?: string }>;
  variant?: "public" | "admin";
}

export function Markdown({
  children,
  className = "",
  mediaAssets,
  variant = "public",
}: MarkdownProps) {
  if (!children) {
    return null;
  }

  const source =
    mediaAssets && mediaAssets.length > 0
      ? resolveMediaReferences(children, mediaAssets)
      : children;

  const YouTubeComponent =
    variant === "admin" ? YouTubePreviewCard : YouTubeEmbed;

  return (
    <div className={`prose-content ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkTextSize]}
        urlTransform={(url) => {
          if (url.startsWith(YOUTUBE_PROTOCOL_PREFIX)) return url;
          return defaultUrlTransform(url);
        }}
        components={{
          img: ({ src, alt }) => {
            if (typeof src === "string" && src.startsWith(YOUTUBE_PROTOCOL_PREFIX)) {
              const videoId = src.slice(YOUTUBE_PROTOCOL_PREFIX.length);
              if (isValidYouTubeId(videoId)) {
                return <YouTubeComponent videoId={videoId} />;
              }
              return null;
            }
            const srcStr = typeof src === "string" ? src : undefined;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={srcStr} alt={alt ?? ""} />;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
