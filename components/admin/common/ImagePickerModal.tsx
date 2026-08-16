'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Link as LinkIcon, Check, Loader2 } from 'lucide-react';

interface ImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, altText?: string, assetRef?: string) => void;
  onUpload?: (formData: FormData) => Promise<{ url: string; assetId: string }>;
  title?: string;
}

const PRESET_PORTFOLIO_IMAGES = [
  {
    title: 'AI Neural Abstract',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1400&q=80',
    category: 'Architecture',
  },
  {
    title: 'High-Performance Servers',
    url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&q=80',
    category: 'Infrastructure',
  },
  {
    title: 'Spatial Holographic UI',
    url: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?auto=format&fit=crop&w=1400&q=80',
    category: 'Spatial / AR',
  },
  {
    title: 'Dark IDE Code & Terminals',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&q=80',
    category: 'Code / IDE',
  },
  {
    title: 'Vector Graph Topologies',
    url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1400&q=80',
    category: 'Data / Graph',
  },
  {
    title: 'Generative Shader Geometry',
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&w=1400&q=80',
    category: 'Graphics / GPU',
  },
  {
    title: 'Dashboard Telemetry Monitor',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80',
    category: 'Telemetry',
  },
  {
    title: 'Cyberpunk Hardware & Motherboard',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80',
    category: 'Hardware',
  },
];

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  onUpload,
  title = 'Select Media Image',
}) => {
  const [activeTab, setActiveTab] = useState<'preset' | 'custom' | 'upload'>('preset');
  const [customUrl, setCustomUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [selectedPresetUrl, setSelectedPresetUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; assetId: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    if (!onUpload) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await onUpload(formData);
      setUploadedFile(result);
      if (!altText) setAltText(file.name.replace(/\.[^.]+$/, ''));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const handleConfirm = () => {
    let finalUrl = '';
    let assetRef: string | undefined;

    if (activeTab === 'preset') {
      finalUrl = selectedPresetUrl;
    } else if (activeTab === 'custom') {
      finalUrl = customUrl.trim();
    } else if (activeTab === 'upload' && uploadedFile) {
      finalUrl = uploadedFile.url;
      assetRef = uploadedFile.assetId;
    }

    if (finalUrl) {
      onSelect(finalUrl, altText.trim() || undefined, assetRef);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-zinc-100">{title}</h3>
              <p className="text-xs text-zinc-400">Choose from curated presets or provide an external image URL</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/50 px-6">
          <button
            onClick={() => setActiveTab('preset')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'preset'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Curated Gallery
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'custom'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            Custom URL
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload File
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[420px] overflow-y-auto space-y-4">
          {activeTab === 'preset' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRESET_PORTFOLIO_IMAGES.map((img) => {
                const isSelected = selectedPresetUrl === img.url;
                return (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => {
                      setSelectedPresetUrl(img.url);
                      if (!altText) setAltText(img.title);
                    }}
                    className={`group relative rounded-xl overflow-hidden border text-left transition-all aspect-4/3 flex flex-col ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                        : 'border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2">
                      <span className="text-[11px] font-medium text-white line-clamp-1">{img.title}</span>
                      <span className="text-[9px] text-zinc-400 uppercase tracking-wider">{img.category}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4 py-2">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Direct Image URL (HTTPS)
                </label>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or https://cdn.domain.com/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              {customUrl && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 overflow-hidden aspect-video max-h-48 flex items-center justify-center">
                  <img
                    src={customUrl}
                    alt="Preview"
                    referrerPolicy="no-referrer"
                    className="max-h-full max-w-full object-contain rounded-lg"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'upload' && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                  handleFileUpload(file);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center gap-3 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-500/5'
                  : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />

              {isUploading ? (
                <>
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-sm font-medium text-zinc-200">Uploading...</p>
                </>
              ) : uploadedFile ? (
                <>
                  <img
                    src={uploadedFile.url}
                    alt="Uploaded"
                    className="max-h-32 max-w-full object-contain rounded-lg border border-zinc-700"
                  />
                  <p className="text-xs text-emerald-400 font-medium">Upload complete</p>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadedFile(null);
                      fileInputRef.current?.click();
                    }}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
                  >
                    Choose Different File
                  </button>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-xl bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      Drag and drop your image file here
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">Supports PNG, JPG, WebP, GIF up to 10MB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
                  >
                    Browse Files
                  </button>
                </>
              )}

              {uploadError && (
                <p className="text-xs text-rose-400 mt-2">{uploadError}</p>
              )}
            </div>
          )}

          {/* Alt text field for accessibility */}
          <div className="pt-2 border-t border-zinc-800/80">
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Alt Text (Accessibility Description)
            </label>
            <input
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              placeholder="Descriptive text for screen readers and SEO..."
              className="w-full px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>
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
            onClick={handleConfirm}
            disabled={
              (activeTab === 'preset' && !selectedPresetUrl) ||
              (activeTab === 'custom' && !customUrl.trim()) ||
              (activeTab === 'upload' && !uploadedFile)
            }
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-950"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Image
          </button>
        </div>
      </div>
    </div>
  );
};
