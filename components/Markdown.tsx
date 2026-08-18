import ReactMarkdown from "react-markdown";
import { defaultUrlTransform } from "react-markdown";
import { rehypeTextSize } from "@/lib/utils/rehype-text-size";
import { YOUTUBE_PROTOCOL_PREFIX, isValidYouTubeId } from "@/lib/utils/youtube";
import { YouTubeEmbed } from "./YouTubeEmbed";

export function Markdown({
  children,
  className = ""
}: {
  children?: string | null;
  className?: string;
}) {
  if (!children) {
    return null;
  }

  return (
    <div className={`prose-content ${className}`.trim()}>
      <ReactMarkdown
        rehypePlugins={[rehypeTextSize]}
        urlTransform={(url) => {
          if (url.startsWith(YOUTUBE_PROTOCOL_PREFIX)) return url;
          return defaultUrlTransform(url);
        }}
        components={{
          img: ({ src, alt }) => {
            if (typeof src === "string" && src.startsWith(YOUTUBE_PROTOCOL_PREFIX)) {
              const videoId = src.slice(YOUTUBE_PROTOCOL_PREFIX.length);
              if (isValidYouTubeId(videoId)) {
                return <YouTubeEmbed videoId={videoId} />;
              }
              return null;
            }
            const srcStr = typeof src === "string" ? src : undefined;
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={srcStr} alt={alt ?? ""} />;
          }
        }}
      >{children}</ReactMarkdown>
    </div>
  );
}
