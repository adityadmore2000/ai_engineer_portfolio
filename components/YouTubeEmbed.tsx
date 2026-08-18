import { isValidYouTubeId, getYouTubeEmbedUrl } from "@/lib/utils/youtube";

export function YouTubeEmbed({ videoId }: { videoId: string }) {
  if (!isValidYouTubeId(videoId)) return null;

  return (
    <div className="relative w-full aspect-video my-4 rounded-lg overflow-hidden border border-slate-200">
      <iframe
        src={getYouTubeEmbedUrl(videoId)}
        title="YouTube video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
}
