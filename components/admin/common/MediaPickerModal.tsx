'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Images, Check, Loader2 } from 'lucide-react';
import { MediaAsset } from '@/lib/admin/types';

export type MediaInsertResult =
  | { type: 'new'; assetRef: string; url: string; alt: string; caption?: string }
  | { type: 'existing'; refId: string; alt: string; caption?: string };

interface MediaPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (result: MediaInsertResult) => void;
  mediaAssets: MediaAsset[];
  onUpload: (formData: FormData) => Promise<{ url: string; assetId: string }>;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const MediaPickerModal: React.FC<MediaPickerModalProps> = ({
  isOpen,
  onClose,
  onInsert,
  mediaAssets,
  onUpload,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'existing'>('upload');
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; assetId: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError('File type not supported. Use PNG, JPG, WebP, or GIF.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File too large. Maximum size is 5MB.');
      return;
    }

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

  const handleConfirm = () => {
    if (activeTab === 'upload' && uploadedFile) {
      onInsert({
        type: 'new',
        assetRef: uploadedFile.assetId,
        url: uploadedFile.url,
        alt: altText.trim(),
        caption: caption.trim() || undefined,
      });
    } else if (activeTab === 'existing' && selectedRefId) {
      onInsert({
        type: 'existing',
        refId: selectedRefId,
        alt: altText.trim(),
        caption: caption.trim() || undefined,
      });
    }
    handleClose();
  };

  const handleClose = () => {
    setAltText('');
    setCaption('');
    setUploadedFile(null);
    setUploadError(null);
    setSelectedRefId(null);
    setActiveTab('upload');
    onClose();
  };

  const canConfirm =
    (activeTab === 'upload' && !!uploadedFile) ||
    (activeTab === 'existing' && !!selectedRefId);

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
              <h3 className="font-semibold text-base text-zinc-100">Insert Image</h3>
              <p className="text-xs text-zinc-400">Upload a new image or select from existing project media</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/50 px-6">
          <button
            onClick={() => setActiveTab('upload')}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'upload'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </button>
          <button
            onClick={() => setActiveTab('existing')}
            disabled={mediaAssets.length === 0}
            className={`py-3 px-4 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed ${
              activeTab === 'existing'
                ? 'border-indigo-500 text-indigo-400 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Images className="w-3.5 h-3.5" />
            Existing Media
            {mediaAssets.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono">
                {mediaAssets.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[400px] overflow-y-auto space-y-4">
          {activeTab === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFileUpload(file);
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
                accept="image/png,image/jpeg,image/webp,image/gif"
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
                    className="max-h-28 max-w-full object-contain rounded-lg border border-zinc-700"
                  />
                  <p className="text-xs text-emerald-400 font-medium">Upload complete</p>
                  <button
                    type="button"
                    onClick={() => { setUploadedFile(null); fileInputRef.current?.click(); }}
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
                    <p className="text-sm font-medium text-zinc-200">Drag and drop an image here</p>
                    <p className="text-xs text-zinc-400 mt-0.5">PNG, JPG, WebP, GIF — up to 5MB</p>
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
              {uploadError && <p className="text-xs text-rose-400">{uploadError}</p>}
            </div>
          )}

          {activeTab === 'existing' && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {mediaAssets.map((asset) => {
                const isSelected = selectedRefId === asset.refId;
                return (
                  <button
                    key={asset.refId}
                    type="button"
                    onClick={() => {
                      setSelectedRefId(asset.refId);
                      if (!altText) setAltText(asset.alt || '');
                    }}
                    className={`group relative rounded-xl overflow-hidden border text-left transition-all aspect-square ${
                      isSelected
                        ? 'border-indigo-500 ring-2 ring-indigo-500/50'
                        : 'border-zinc-800 hover:border-zinc-600'
                    }`}
                  >
                    <img
                      src={asset.url}
                      alt={asset.alt}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] font-mono text-zinc-400 truncate">{asset.refId}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Alt text & caption */}
          <div className="pt-2 border-t border-zinc-800/80 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Alt Text <span className="text-zinc-500">(accessibility description)</span>
              </label>
              <input
                type="text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder="Describe this image for screen readers..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Caption <span className="text-zinc-500">(optional, shown below image)</span>
              </label>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Optional caption text..."
                className="w-full px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-950 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-6 py-4 bg-zinc-950/70">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-xl border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium text-white transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-950"
          >
            <Check className="w-3.5 h-3.5" />
            Insert Image
          </button>
        </div>
      </div>
    </div>
  );
};
