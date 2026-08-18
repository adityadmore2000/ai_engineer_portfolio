'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Check } from 'lucide-react';
import { extractVideoId, getYouTubeThumbnailUrl, YOUTUBE_PROTOCOL_PREFIX } from '@/lib/utils/youtube';

interface YouTubeInsertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (markdown: string) => void;
}

export const YouTubeInsertModal: React.FC<YouTubeInsertModalProps> = ({
  isOpen,
  onClose,
  onInsert,
}) => {
  const [url, setUrl] = useState('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setVideoId(null);
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleUrlChange = (value: string) => {
    setUrl(value);
    if (!value.trim()) {
      setVideoId(null);
      setError(null);
      return;
    }
    const id = extractVideoId(value.trim());
    if (id) {
      setVideoId(id);
      setError(null);
    } else {
      setVideoId(null);
      setError('Not a valid YouTube URL');
    }
  };

  const handleInsert = () => {
    if (!videoId) return;
    onInsert(`\n![video](${YOUTUBE_PROTOCOL_PREFIX}${videoId})\n`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <Play className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-100">Insert YouTube Video</h3>
              <p className="text-xs text-zinc-400">Paste a YouTube URL to embed a video</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">YouTube URL</label>
            <input
              ref={inputRef}
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500"
            />
            {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
          </div>

          {videoId && (
            <div className="rounded-xl overflow-hidden border border-zinc-800">
              <div className="relative">
                <img
                  src={getYouTubeThumbnailUrl(videoId)}
                  alt="Video thumbnail"
                  className="w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black/70 flex items-center justify-center">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>
              <div className="px-3 py-2 bg-zinc-950/60">
                <p className="text-[11px] font-mono text-zinc-400">ID: {videoId}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-6 py-4 bg-zinc-950/70">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!videoId}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors flex items-center gap-1.5 shadow-md shadow-red-950"
          >
            <Check className="w-3.5 h-3.5" />
            Insert Video
          </button>
        </div>
      </div>
    </div>
  );
};
