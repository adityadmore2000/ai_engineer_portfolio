import React from 'react';
import { getYouTubeThumbnailUrl, isValidYouTubeId } from '@/lib/utils/youtube';

interface YouTubePreviewCardProps {
  videoId: string;
}

export function YouTubePreviewCard({ videoId }: YouTubePreviewCardProps) {
  if (!isValidYouTubeId(videoId)) {
    return (
      <div className="my-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-500">
        Invalid YouTube video ID: {videoId}
      </div>
    );
  }

  const thumbnailUrl = getYouTubeThumbnailUrl(videoId);

  return (
    <figure className="my-4">
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 shadow-sm">
        <img
          src={thumbnailUrl}
          alt={`YouTube video ${videoId}`}
          loading="lazy"
          className="w-full object-cover opacity-80"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 shadow-lg">
            <svg className="ml-1 h-5 w-5 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <figcaption className="mt-1.5 text-center font-mono text-[10px] text-slate-400">
        youtube://{videoId}
      </figcaption>
    </figure>
  );
}
