'use client';

import React, { useState } from 'react';
import {
  GripVertical,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  Type,
  FileText,
} from 'lucide-react';
import { ProjectSection } from '@/lib/admin/types';
import { MarkdownEditor } from '@/components/admin/common/MarkdownEditor';

interface SectionCardProps {
  section: ProjectSection;
  index: number;
  totalCount: number;
  onUpdate: (updated: Partial<ProjectSection>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  section,
  index,
  totalCount,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isFirst = index === 0;
  const isLast = index === totalCount - 1;

  return (
    <div
      id={`project-section-card-${section.id}`}
      className="group relative rounded-2xl border border-slate-200 bg-white shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all overflow-hidden"
    >
      {/* Section Header Bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50/80 border-b border-slate-200">
        {/* Left: Drag grip & section number badge & title preview */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing p-1 -ml-1 rounded-md"
            title="Section drag position"
          >
            <GripVertical className="w-4 h-4" />
          </div>

          {/* Section Index Badge */}
          <span className="shrink-0 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Section {index + 1}
          </span>

          {/* Title preview when collapsed or subtitle */}
          <div className="min-w-0 flex-1">
            <span
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="font-semibold text-xs sm:text-sm text-slate-800 hover:text-indigo-600 truncate block cursor-pointer transition-colors"
            >
              {section.title || <span className="text-slate-400 italic font-normal">Untitled Section</span>}
            </span>
          </div>
        </div>

        {/* Right: Section Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={isFirst}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            title={isFirst ? 'First section' : 'Move section up'}
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onMoveDown}
            disabled={isLast}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
            title={isLast ? 'Last section' : 'Move section down'}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onDuplicate}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title="Duplicate section"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 transition-colors"
            title={isCollapsed ? 'Expand section' : 'Collapse section'}
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          <div className="w-px h-4 bg-slate-200 mx-0.5" />

          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete section"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Section Content Fields (Expandable) */}
      {!isCollapsed && (
        <div className="p-5 sm:p-6 space-y-5 animate-in fade-in duration-150">
          {/* Section Title Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-indigo-600" />
              <span>Section Title <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              value={section.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="e.g. The Problem, System Architecture, Key Engineering Decisions, Benchmarks..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Section Description with Markdown Editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                <span>Section Description</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">Supports Markdown & Code formatting</span>
            </div>
            <MarkdownEditor
              value={section.description}
              onChange={(val) => onUpdate({ description: val })}
              placeholder="Write the section narrative in markdown... Describe the problem, technical diagrams, code snippets, engineering decisions, or results."
              minHeight="170px"
            />
          </div>
        </div>
      )}
    </div>
  );
};
