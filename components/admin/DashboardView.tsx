'use client';

import React from 'react';
import {
  FolderGit2,
  CheckCircle2,
  FileEdit,
  Plus,
  ArrowUpRight,
  Sparkles,
  Eye,
  Layers,
  Activity,
  Briefcase,
  Wrench,
} from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';
import { MaintenanceCard } from './MaintenanceCard';
import { AiChatCard } from './AiChatCard';

export const DashboardView: React.FC = () => {
  const { projects, experiences, navigateTo, openCreateModal, isLoading } = usePortfolio();
  const onOpenNewProject = openCreateModal;

  const total = projects.length;
  const published = projects.filter((p) => p.published).length;
  const drafts = projects.filter((p) => !p.published).length;
  const experienceCount = experiences.length;

  const recentProjects = [...projects]
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .slice(0, 6);

  return (
    <div id="admin-dashboard-view" className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Portfolio Admin</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              CMS Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage, craft, preview, and publish your engineering portfolio projects.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-dashboard-new-project"
            onClick={onOpenNewProject}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div
          onClick={() => navigateTo({ view: 'projects' })}
          className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">
              Total Projects
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:text-indigo-600 transition-colors">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900 font-mono">
              {isLoading ? '—' : total}
            </span>
            <span className="text-xs text-slate-400">in catalog</span>
          </div>
        </div>

        {/* Published Projects */}
        <div
          onClick={() => navigateTo({ view: 'projects' })}
          className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">
              Published
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-600 font-mono">
              {isLoading ? '—' : published}
            </span>
            <span className="text-xs text-slate-400">visible live</span>
          </div>
        </div>

        {/* Draft Projects */}
        <div
          onClick={() => navigateTo({ view: 'projects' })}
          className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">
              Drafts
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 group-hover:scale-105 transition-transform">
              <FileEdit className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-amber-600 font-mono">
              {isLoading ? '—' : drafts}
            </span>
            <span className="text-xs text-slate-400">unpublished</span>
          </div>
        </div>

        {/* Experience Positions */}
        <div
          onClick={() => navigateTo({ view: 'experience' })}
          className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 font-mono uppercase tracking-wider">
              Experience
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-indigo-600 font-mono">{experienceCount}</span>
            <span className="text-xs text-slate-400">positions</span>
          </div>
        </div>
      </div>

      {/* Editorial Core Flow Highlight */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-white to-white p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Editorial Mental Model</span>
              <span className="font-mono text-[11px] text-indigo-600 font-semibold">
                Edit → Preview → Publish
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Draft changes remain isolated and high-fidelity previewed until confirmed for publication.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigateTo({ view: 'projects' })}
          className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-800 transition-colors px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-indigo-200 shadow-2xs"
        >
          <span>View All Projects</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Recent Projects Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
              Projects
            </h2>
          </div>
          <button
            onClick={() => navigateTo({ view: 'projects' })}
            className="text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
          >
            See all ({projects.length})
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100 shadow-xs">
            {recentProjects.map((project) => (
              <div
                key={project._id}
                className="p-4 sm:px-6 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                {/* Left info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                    {project.coverImage?.url ? (
                      <img
                        src={project.coverImage.url}
                        alt={project.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                        <Layers className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4
                        onClick={() =>
                          navigateTo({ view: 'project_edit', projectId: project._id })
                        }
                        className="font-bold text-sm text-slate-900 hover:text-indigo-600 cursor-pointer truncate transition-colors"
                      >
                        {project.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 font-mono">
                      <span>/projects/{project.slug}</span>
                    </div>
                  </div>
                </div>

                {/* Right badges & actions */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  {/* Publication pill */}
                  {project.published ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Published
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Draft
                    </span>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                    <button
                      onClick={() =>
                        navigateTo({ view: 'preview', projectId: project._id })
                      }
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Preview public representation"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        navigateTo({ view: 'project_edit', projectId: project._id })
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Maintenance Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
            Site Maintenance
          </h2>
        </div>
        <MaintenanceCard />
      </div>

      {/* AI Chat Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono">
            AI Features
          </h2>
        </div>
        <AiChatCard />
      </div>
    </div>
  );
};
