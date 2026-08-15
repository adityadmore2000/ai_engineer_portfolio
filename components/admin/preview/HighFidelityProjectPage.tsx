'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Globe,
  Monitor,
  Tablet,
  Smartphone,
  Share2,
  BookOpen,
} from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';
import { renderMarkdown } from '@/lib/admin/utils/markdown-parser';
import { PublishConfirmModal } from '@/components/admin/ProjectEditor/PublishConfirmModal';

interface HighFidelityProjectPageProps {
  projectId: string;
  isLivePublic?: boolean;
}

export const HighFidelityProjectPage: React.FC<HighFidelityProjectPageProps> = ({
  projectId,
  isLivePublic = false,
}) => {
  const {
    getProjectById,
    projects,
    navigateTo,
    publishProject,
    showToast,
  } = usePortfolio();

  const [deviceFrame, setDeviceFrame] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

  const project = getProjectById(projectId) || projects[0];

  if (!project) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 flex items-center justify-center p-6">
        <div className="text-center space-y-4 bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
          <h2 className="text-xl font-bold text-slate-900">Project Not Found</h2>
          <button
            onClick={() => navigateTo({ view: 'projects' })}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-semibold text-white cursor-pointer shadow-xs"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentIndex = projects.findIndex((p) => p._id === project._id);
  const prevProject = currentIndex > 0 ? projects[currentIndex - 1] : null;
  const nextProject = currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null;

  const sections = project.sections || [];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Floating Preview Toolbar */}
      <header
        id="preview-mode-toolbar"
        className="sticky top-0 z-40 bg-white/95 border-b border-slate-200 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs"
      >
        {/* Left: Back to Editor & URL display */}
        <div className="flex items-center gap-3">
          <button
            id="btn-preview-back-to-editor"
            type="button"
            onClick={() =>
              navigateTo({
                view: 'project_edit',
                projectId: project._id,
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors border border-slate-200 shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Editor</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">preview:</span>
            <span className="text-indigo-700 font-semibold truncate max-w-xs">
              /projects/{project.slug}
            </span>
          </div>
        </div>

        {/* Center: Device Switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setDeviceFrame('desktop')}
            className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
              deviceFrame === 'desktop'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Desktop View (Full Width)"
          >
            <Monitor className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeviceFrame('tablet')}
            className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
              deviceFrame === 'tablet'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Tablet View (768px)"
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeviceFrame('mobile')}
            className={`p-1.5 rounded-lg text-xs font-semibold transition-all ${
              deviceFrame === 'mobile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Mobile View (390px)"
          >
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {/* Right: State indicator & Publish button */}
        <div className="flex items-center gap-2">
          {project.published ? (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Live Public Version
            </span>
          ) : (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Previewing Draft
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText?.(window.location.href);
              showToast('success', 'Preview link copied to clipboard');
            }}
            className="p-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            title="Copy preview link"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <button
            id="btn-preview-publish-now"
            type="button"
            onClick={() => setIsPublishModalOpen(true)}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Publish Live</span>
          </button>
        </div>
      </header>

      {/* Main Preview Container with Responsive Framing */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center">
        <main
          className={`w-full bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 sm:p-10 md:p-14 space-y-12 transition-all duration-300 ${
            deviceFrame === 'desktop'
              ? 'max-w-4xl'
              : deviceFrame === 'tablet'
              ? 'max-w-2xl'
              : 'max-w-md'
          }`}
        >
          {/* Public Website Header Nav Mock */}
          <nav className="flex items-center justify-between border-b border-slate-100 pb-6 text-xs text-slate-500 font-mono">
            <div className="flex items-center gap-2 text-slate-800 font-bold">
              <span>←</span>
              <button
                type="button"
                onClick={() => navigateTo({ view: 'projects' })}
                className="hover:text-indigo-600 transition-colors cursor-pointer"
              >
                All Projects
              </button>
            </div>
            <div className="flex items-center gap-4">
              <span>Order #{project.displayOrder || 1}</span>
            </div>
          </nav>

          {/* Project Hero Section */}
          <header className="space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-[1.15]">
              {project.title}
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl font-normal">
              {project.shortSummary}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              {project.technologies.map((tech) => (
                <span
                  key={tech}
                  className="px-3 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-mono border border-slate-200 shadow-2xs font-medium"
                >
                  {tech}
                </span>
              ))}
            </div>
          </header>

          {/* Dynamic Narrative Project Sections */}
          <article className="space-y-12 pt-6 border-t border-slate-100">
            {sections.length > 0 ? (
              sections.map((section, idx) => (
                <section key={section.id} className="space-y-4 scroll-mt-20">
                  {section.title && (
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        0{idx + 1}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                        {section.title}
                      </h2>
                    </div>
                  )}
                  <div className="text-slate-700 leading-relaxed text-sm sm:text-base">
                    {renderMarkdown(section.description || '')}
                  </div>
                </section>
              ))
            ) : (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-600">No project sections created yet.</p>
                <p className="text-xs text-slate-400">
                  Switch back to the Editor to add custom narrative sections.
                </p>
              </div>
            )}
          </article>

          {/* Previous / Next Project Navigation Footer */}
          <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            {prevProject ? (
              <button
                type="button"
                onClick={() => navigateTo({ view: 'preview', projectId: prevProject._id })}
                className="w-full sm:w-auto p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 text-left transition-all shadow-2xs group cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
                  ← Previous Project
                </span>
                <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  {prevProject.title}
                </span>
              </button>
            ) : (
              <div />
            )}

            {nextProject ? (
              <button
                type="button"
                onClick={() => navigateTo({ view: 'preview', projectId: nextProject._id })}
                className="w-full sm:w-auto p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 text-right transition-all shadow-2xs group cursor-pointer"
              >
                <span className="text-[10px] text-slate-400 font-mono uppercase font-bold block">
                  Next Project →
                </span>
                <span className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
                  {nextProject.title}
                </span>
              </button>
            ) : (
              <div />
            )}
          </div>
        </main>
      </div>

      {/* Publish Confirmation Modal */}
      <PublishConfirmModal
        isOpen={isPublishModalOpen}
        project={project}
        onClose={() => setIsPublishModalOpen(false)}
        onConfirm={() => publishProject(project._id)}
      />
    </div>
  );
};
