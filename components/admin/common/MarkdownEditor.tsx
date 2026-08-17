'use client';

import React, { useState, useRef } from 'react';
import {
  Heading2,
  Heading3,
  Bold,
  Italic,
  Code,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Table as TableIcon,
  Eye,
  Edit3,
  Sparkles,
} from 'lucide-react';
import { renderMarkdown } from '@/lib/admin/utils/markdown-parser';
import { resolveMediaReferences } from '@/lib/utils/resolve-media-references';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  label?: string;
  badge?: string;
  mediaAssets?: Array<{ refId: string; url?: string; alt?: string }>;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write in Markdown...',
  minHeight = '180px',
  label,
  badge,
  mediaAssets = [],
}) => {
  const resolvedValue = resolveMediaReferences(value, mediaAssets);
  const [viewMode, setViewMode] = useState<'write' | 'preview' | 'split'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef<boolean>(false);

  const handleTextareaScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (isSyncingRef.current) return;
    const el = e.currentTarget;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    isSyncingRef.current = true;
    const pct = el.scrollTop / scrollable;
    if (previewRef.current) {
      const previewScrollable = previewRef.current.scrollHeight - previewRef.current.clientHeight;
      previewRef.current.scrollTop = pct * previewScrollable;
    }
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  };

  const handlePreviewScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current) return;
    const el = e.currentTarget;
    const scrollable = el.scrollHeight - el.clientHeight;
    if (scrollable <= 0) return;
    isSyncingRef.current = true;
    const pct = el.scrollTop / scrollable;
    if (textareaRef.current) {
      const textareaScrollable = textareaRef.current.scrollHeight - textareaRef.current.clientHeight;
      textareaRef.current.scrollTop = pct * textareaScrollable;
    }
    requestAnimationFrame(() => { isSyncingRef.current = false; });
  };

  const insertFormat = (before: string, after: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || defaultText;
    const replacement = `${before}${selectedText}${after}`;

    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 10);
  };

  const wordCount = value.trim() ? value.trim().split(/\s+/).length : 0;
  const charCount = value.length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden focus-within:border-indigo-400 transition-all shadow-2xs">
      {/* Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          {label && (
            <span className="font-bold text-slate-800 mr-2 flex items-center gap-1.5 font-mono">
              {label}
              {badge && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-200 text-slate-700 font-semibold">
                  {badge}
                </span>
              )}
            </span>
          )}

          {/* Action formatting buttons */}
          <button
            type="button"
            onClick={() => insertFormat('## ', '', 'Section Heading')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Heading 2 (##)"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('### ', '', 'Subheading')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Heading 3 (###)"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>
          <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={() => insertFormat('**', '**', 'bold text')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Bold (**text**)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('*', '*', 'italic text')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Italic (*text*)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('`', '`', 'code')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Inline Code (`code`)"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('```typescript\n', '\n```', '// Code snippet here\nconst result = true;')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded font-mono text-[11px] font-semibold transition-colors"
            title="Code Block (```)"
          >
            {`{ }`}
          </button>
          <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={() => insertFormat('- ', '', 'List item')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Bullet List (- item)"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('1. ', '', 'Step item')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Ordered List (1. item)"
          >
            <ListOrdered className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('> ', '', 'Important note or quote')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Quote / Callout (> quote)"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat('[', '](https://example.com)', 'link label')}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Insert Link [title](url)"
          >
            <LinkIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              insertFormat(
                '| Metric | Baseline | Optimized |\n| --- | --- | --- |\n| Latency | 450ms | **78ms** |\n| Memory | 24GB | **7.6GB** |\n',
                '',
                ''
              )
            }
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
            title="Insert Table"
          >
            <TableIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View Mode Toggle (Write / Preview / Split) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('write')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'write'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              Write
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'preview'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" />
              Preview
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                viewMode === 'split'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Split
            </button>
          </div>
        </div>
      </div>

      {/* Editor Body */}
      <div className="grid grid-cols-1 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        {viewMode === 'split' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-x divide-slate-200">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onScroll={handleTextareaScroll}
              placeholder={placeholder}
              style={{ minHeight }}
              className="w-full bg-white p-4 font-mono text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden overflow-y-auto max-h-[450px] leading-relaxed"
            />
            <div
              ref={previewRef}
              style={{ minHeight }}
              className="p-4 bg-slate-50/50 overflow-y-auto max-h-[450px]"
              onScroll={handlePreviewScroll}
            >
              {renderMarkdown(resolvedValue)}
            </div>
          </div>
        ) : viewMode === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ minHeight }}
            className="w-full bg-white p-4 font-mono text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden resize-y leading-relaxed"
          />
        ) : (
          <div
            style={{ minHeight }}
            className="p-4 bg-slate-50/50 overflow-y-auto max-h-[450px]"
          >
            {renderMarkdown(value)}
          </div>
        )}
      </div>

      {/* Footer info stats */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 font-mono">
        <span className="flex items-center gap-2">
          <span>Markdown enabled</span>
          <span>•</span>
          <span>Shortcuts supported</span>
        </span>
        <span className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span>{charCount} chars</span>
        </span>
      </div>
    </div>
  );
};
