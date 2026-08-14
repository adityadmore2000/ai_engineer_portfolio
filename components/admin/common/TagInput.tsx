'use client';

import React, { useState, useRef } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

const DEFAULT_TECH_SUGGESTIONS = [
  'TypeScript',
  'Python',
  'PyTorch',
  'Rust',
  'Go',
  'React',
  'Next.js',
  'FastAPI',
  'Docker',
  'WebGPU',
  'TailwindCSS',
  'CUDA',
  'Redis',
  'PostgreSQL',
  'C++',
  'Swift',
  'Whisper',
  'visionOS',
  'Metal',
  'Kubernetes',
  'GraphQL',
];

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  onChange,
  suggestions = DEFAULT_TECH_SUGGESTIONS,
  placeholder = 'Add technology...',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpenSuggestions, setIsOpenSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const filteredSuggestions = suggestions.filter(
    (s) =>
      !tags.includes(s) &&
      s.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus-within:border-indigo-500 focus-within:bg-white focus-within:ring-1 focus-within:ring-indigo-500 transition-all min-h-[46px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white text-slate-800 text-xs font-mono font-semibold border border-slate-200 shadow-2xs"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="text-slate-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
              title={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        <div className="relative flex-1 min-w-[140px]">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpenSuggestions(true);
            }}
            onFocus={() => setIsOpenSuggestions(true)}
            onBlur={() => setTimeout(() => setIsOpenSuggestions(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : 'Add more...'}
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden py-1 px-1"
          />

          {isOpenSuggestions && inputValue.trim() && filteredSuggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1.5 w-64 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl z-30 p-1.5">
              <div className="text-[10px] uppercase font-bold text-slate-500 px-2 py-1 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-600" /> Suggestions
              </div>
              {filteredSuggestions.slice(0, 6).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => addTag(item)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 rounded-md transition-colors flex items-center justify-between font-medium cursor-pointer"
                >
                  <span>{item}</span>
                  <Plus className="w-3 h-3 opacity-60" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick click suggestions */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 pt-1">
        <span className="text-[11px] text-slate-500 mr-1 font-medium">Quick add:</span>
        {suggestions
          .filter((s) => !tags.includes(s))
          .slice(0, 7)
          .map((tech) => (
            <button
              key={tech}
              type="button"
              onClick={() => addTag(tech)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-2.5 h-2.5" />
              {tech}
            </button>
          ))}
      </div>
    </div>
  );
};
