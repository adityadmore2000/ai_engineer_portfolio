'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  ImagePlus,
  Table as TableIcon,
  Eye,
  Edit3,
  Sparkles,
  Type,
  ChevronDown,
} from 'lucide-react';
import { renderMarkdown } from '@/lib/admin/utils/markdown-parser';
import { resolveMediaReferences } from '@/lib/utils/resolve-media-references';

const SIZE_OPTIONS = [
  { label: 'Small', token: 'sm' },
  { label: 'Normal', token: 'base' },
  { label: 'Large', token: 'lg' },
  { label: 'Extra Large', token: 'xl' },
  { label: 'Display', token: '2xl' },
] as const;

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  label?: string;
  badge?: string;
  mediaAssets?: Array<{ refId: string; url?: string; alt?: string }>;
  onInsertImage?: (insertAtCursor: (text: string) => void) => void;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write in Markdown...',
  minHeight = '180px',
  label,
  badge,
  mediaAssets = [],
  onInsertImage,
}) => {
  const resolvedValue = resolveMediaReferences(value, mediaAssets);
  const [viewMode, setViewMode] = useState<'write' | 'preview' | 'split'>('write');
  const [showSizeDropdown, setShowSizeDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef<boolean>(false);
  const savedCursorRef = useRef<number>(0);
  const sizeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSizeDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(e.target as Node)) {
        setShowSizeDropdown(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowSizeDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showSizeDropdown]);

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

  const handleInsertImageClick = () => {
    if (!onInsertImage) return;
    if (textareaRef.current) {
      savedCursorRef.current = textareaRef.current.selectionStart;
    }
    const pos = savedCursorRef.current;
    onInsertImage((text: string) => {
      const newValue = value.substring(0, pos) + text + value.substring(pos);
      onChange(newValue);
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.setSelectionRange(pos + text.length, pos + text.length);
      }, 10);
    });
  };

  const applyTextSize = (token: string) => {
    setShowSizeDropdown(false);
    if (token === 'base') {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);
      const stripped = selectedText
        .replace(/\{size:(?:sm|base|lg|xl|2xl)\}/g, '')
        .replace(/\{\/size\}/g, '');
      const newValue = value.substring(0, start) + stripped + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start, start + stripped.length);
      }, 10);
    } else {
      insertFormat(`{size:${token}}`, `{/size}`, 'text');
    }
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
          {onInsertImage && (
            <button
              type="button"
              onClick={handleInsertImageClick}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
              title="Insert Image"
            >
              <ImagePlus className="w-3.5 h-3.5" />
            </button>
          )}
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
          <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
          <div className="relative" ref={sizeDropdownRef}>
            <button
              type="button"
              onClick={() => setShowSizeDropdown(v => !v)}
              className="flex items-center gap-0.5 p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded transition-colors"
              title="Text Size"
            >
              <Type className="w-3.5 h-3.5" />
              <ChevronDown className="w-2.5 h-2.5" />
            </button>
            {showSizeDropdown && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[130px] py-1">
                {SIZE_OPTIONS.map(({ label, token }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => applyTextSize(token)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between gap-3"
                  >
                    <span>{label}</span>
                    {token !== 'base' && (
                      <span className="text-slate-400 font-mono text-[10px]">{token}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
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
              onSelect={(e) => { savedCursorRef.current = e.currentTarget.selectionStart; }}
              onClick={(e) => { savedCursorRef.current = e.currentTarget.selectionStart; }}
              onKeyUp={(e) => { savedCursorRef.current = (e.target as HTMLTextAreaElement).selectionStart; }}
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
            onSelect={(e) => { savedCursorRef.current = e.currentTarget.selectionStart; }}
            onClick={(e) => { savedCursorRef.current = e.currentTarget.selectionStart; }}
            onKeyUp={(e) => { savedCursorRef.current = (e.target as HTMLTextAreaElement).selectionStart; }}
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
