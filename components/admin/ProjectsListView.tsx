'use client';

import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Layers,
  Globe,
  EyeOff,
} from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';
import { Project } from '@/lib/admin/types';
import { DeleteConfirmModal } from '@/components/admin/DeleteConfirmModal';

const STATUS_OPTIONS = ['ALL', 'Published', 'Draft'];

export const ProjectsListView: React.FC = () => {
  const {
    projects,
    navigateTo,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortBy,
    setSortBy,
    deleteProject,
    publishProject,
    unpublishProject,
    openCreateModal: onOpenNewProject,
    isLoading,
  } = usePortfolio();

  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    return projects
      .filter((project) => {
        if (statusFilter === 'Published' && !project.published) return false;
        if (statusFilter === 'Draft' && project.published) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchesTitle = project.title.toLowerCase().includes(q);
          const matchesSlug = project.slug.toLowerCase().includes(q);
          const matchesSummary = project.shortSummary.toLowerCase().includes(q);
          const matchesTech = project.technologies.some((t) => t.toLowerCase().includes(q));
          if (!matchesTitle && !matchesSlug && !matchesSummary && !matchesTech) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'order') {
          return (a.displayOrder || 0) - (b.displayOrder || 0);
        }
        if (sortBy === 'title') {
          return a.title.localeCompare(b.title);
        }
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });
  }, [projects, searchQuery, statusFilter, sortBy]);

  if (isLoading) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects Directory</h1>
            <p className="text-xs text-slate-500 mt-1">Loading projects from Sanity...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      id="admin-projects-list-view"
      className="p-6 md:p-10 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200"
    >
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Projects Directory</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {filteredProjects.length} of {projects.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Browse, filter, edit narrative sections, and manage publishing states.
          </p>
        </div>

        <button
          id="btn-projects-new"
          onClick={onOpenNewProject}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Search, Filter, Sort Controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects by title, technology, slug..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 focus:bg-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 hover:text-slate-800 font-mono px-1.5 py-0.5 rounded bg-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          {/* Status filter dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs text-slate-700 focus:outline-hidden font-medium py-1 pr-2 cursor-pointer"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt} className="bg-white text-slate-800">
                  {opt === 'ALL' ? 'All Projects' : opt}
                </option>
              ))}
            </select>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'updated' | 'order' | 'title')}
              className="bg-transparent text-xs text-slate-700 focus:outline-hidden font-medium py-1 pr-2 cursor-pointer"
            >
              <option value="order" className="bg-white text-slate-800">
                Display Order
              </option>
              <option value="title" className="bg-white text-slate-800">
                Alphabetical Title
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Projects Table / Card List */}
      {filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">No matching projects found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or status filter to find what you&apos;re looking for.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('ALL');
            }}
            className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-100">
          {/* Table Header (Desktop) */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50/80 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200 rounded-t-2xl">
            <div className="col-span-6">Project &amp; Identifier</div>
            <div className="col-span-4">Publication State</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Table Rows */}
          {filteredProjects.map((project) => (
            <div
              key={project._id}
              className="p-4 md:px-6 md:py-4.5 hover:bg-slate-50/70 transition-colors flex flex-col md:grid md:grid-cols-12 md:items-center gap-4 group last:rounded-b-2xl"
            >
              {/* Project Title & Meta (Col 6) */}
              <div className="col-span-6 flex items-start gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200 shadow-2xs">
                  {project.coverImage?.url ? (
                    <img
                      src={project.coverImage.url}
                      alt={project.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400">
                      <Layers className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      onClick={() =>
                        navigateTo({
                          view: 'project_edit',
                          projectId: project._id,
                        })
                      }
                      className="font-bold text-sm text-slate-900 hover:text-indigo-600 cursor-pointer truncate transition-colors"
                    >
                      {project.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
                    <span className="truncate">/{project.slug}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {project.technologies.slice(0, 3).map((tech) => (
                      <span
                        key={tech}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-mono border border-slate-200"
                      >
                        {tech}
                      </span>
                    ))}
                    {project.technologies.length > 3 && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        +{project.technologies.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Publication State (Col 4) */}
              <div className="col-span-4 flex flex-col gap-1">
                {project.published ? (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Published
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Draft
                    </span>
                  </div>
                )}
              </div>

              {/* Actions (Col 2) */}
              <div className="col-span-2 flex items-center justify-end gap-1.5 self-end md:self-auto">
                <button
                  onClick={() =>
                    navigateTo({ view: 'preview', projectId: project._id })
                  }
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Live Public Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>

                <button
                  onClick={() =>
                    navigateTo({
                      view: 'project_edit',
                      projectId: project._id,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-transparent text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs"
                >
                  <Edit className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>

                {/* Context menu toggle */}
                <div className="relative">
                  <button
                    onClick={() =>
                      setActiveMenuId(activeMenuId === project._id ? null : project._id)
                    }
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="More options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {activeMenuId === project._id && (
                    <div
                      onMouseLeave={() => setActiveMenuId(null)}
                      className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-slate-200 bg-white shadow-xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          navigateTo({
                            view: 'preview',
                            projectId: project._id,
                          });
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-md transition-colors flex items-center gap-2 font-medium"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>Preview</span>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      {project.published ? (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            unpublishProject(project._id);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-amber-700 hover:bg-amber-50 rounded-md transition-colors flex items-center gap-2 font-medium"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Unpublish</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            publishProject(project._id);
                          }}
                          className="w-full text-left px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors flex items-center gap-2 font-medium"
                        >
                          <Globe className="w-3.5 h-3.5" />
                          <span>Publish</span>
                        </button>
                      )}

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        onClick={() => {
                          setActiveMenuId(null);
                          setProjectToDelete(project);
                        }}
                        className="w-full text-left px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-md transition-colors flex items-center gap-2 font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete...</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modals */}
      <DeleteConfirmModal
        isOpen={!!projectToDelete}
        project={projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={(id) => deleteProject(id)}
      />
    </div>
  );
};
