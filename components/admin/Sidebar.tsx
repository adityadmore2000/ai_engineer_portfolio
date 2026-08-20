'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import {
  LayoutDashboard,
  FolderGit2,
  Briefcase,
  HelpCircle,
  MessageCircle,
  Wrench,
  ExternalLink,
  Settings,
  LogOut,
  Sparkles,
  Plus,
  Compass,
  ChevronUp,
} from 'lucide-react';
import { usePortfolio } from '@/lib/admin/context';

interface SidebarProps {
  onOpenNewProject: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenNewProject }) => {
  const { navigateTo, projects, experiences, showToast } = usePortfolio();
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isProfileMenuOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/admin/api/auth/logout', { method: 'POST' });
      await signOut(auth);
    } catch {
      showToast('error', 'Logout failed', 'Please try again.');
      setIsLoggingOut(false);
      return;
    }
    router.push('/admin/login');
  };

  const isDashboard = pathname === '/admin';
  const isProjects = pathname.startsWith('/admin/projects');
  const isExperience = pathname === '/admin/experience';
  const isFaq = pathname === '/admin/faqs';
  const isContact = pathname === '/admin/contact';

  const publishedCount = projects.filter((p) => p.published).length;

  return (
    <aside
      id="admin-sidebar"
      className="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between h-screen sticky top-0 select-none z-20 shadow-xs"
    >
      {/* Brand & Quick Action */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between px-2 pt-1">
          <div
            onClick={() => navigateTo({ view: 'dashboard' })}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-sm tracking-tight text-slate-900 font-mono">
                  Portfolio<span className="text-indigo-600">.Admin</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono font-medium">Editorial CMS v1.0</p>
            </div>
          </div>
        </div>

        {/* Quick create action */}
        <button
          id="btn-sidebar-quick-create"
          type="button"
          onClick={onOpenNewProject}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold shadow-sm shadow-indigo-200 transition-all hover:shadow-md cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Project
        </button>

        {/* Core Navigation Section */}
        <div className="space-y-1 pt-2">
          <div className="px-3 pb-1 text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-400">
            Core CMS
          </div>
          <button
            id="nav-link-dashboard"
            type="button"
            onClick={() => navigateTo({ view: 'dashboard' })}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isDashboard
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <LayoutDashboard className={`w-4 h-4 ${isDashboard ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Dashboard</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
              /admin
            </span>
          </button>

          <button
            id="nav-link-projects"
            type="button"
            onClick={() => navigateTo({ view: 'projects' })}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isProjects
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderGit2 className={`w-4 h-4 ${isProjects ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Projects</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
              isProjects ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {projects.length}
            </span>
          </button>

          <button
            id="nav-link-experience"
            type="button"
            onClick={() => navigateTo({ view: 'experience' })}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isExperience
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Briefcase className={`w-4 h-4 ${isExperience ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Experience</span>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
              isExperience ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {experiences.length}
            </span>
          </button>

          <button
            id="nav-link-faq"
            type="button"
            onClick={() => navigateTo({ view: 'faq' })}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isFaq
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle className={`w-4 h-4 ${isFaq ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>FAQ</span>
            </div>
          </button>

          <button
            id="nav-link-contact"
            type="button"
            onClick={() => navigateTo({ view: 'contact' })}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              isContact
                ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <MessageCircle className={`w-4 h-4 ${isContact ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Contact</span>
            </div>
          </button>

        </div>

        {/* Future Modules Section (Coming later) */}
        <div className="space-y-1 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between px-3 pb-1 text-[10px] uppercase font-mono font-semibold tracking-wider text-slate-400">
            <span>Future Modules</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-400 lowercase font-mono">
              roadmap
            </span>
          </div>

          {[
            { label: 'Skills', icon: Wrench },
          ].map(({ label, icon: Icon }) => (
            <div
              key={label}
              onClick={() =>
                showToast(
                  'info',
                  `${label} module`,
                  'This section is part of the future extension roadmap.'
                )
              }
              className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="w-4 h-4 text-slate-400 group-hover:text-slate-500" />
                <span>{label}</span>
              </div>
              <span className="text-[9px] text-slate-400 font-mono">Later</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Footer Section */}
      <div className="p-4 border-t border-slate-200 space-y-2 bg-slate-50/70">
        {/* View Website */}
        <button
          id="btn-nav-view-website"
          type="button"
          onClick={() => {
            const firstPublished = projects.find((p) => p.published) || projects[0];
            if (firstPublished) {
              navigateTo({ view: 'preview', projectId: firstPublished._id, isLivePublic: true });
            } else {
              showToast('info', 'No published projects yet', 'Publish a project to see the public view.');
            }
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors"
        >
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-indigo-600" />
            <span className="font-semibold">View Public Site</span>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {/* User Card & Profile Menu */}
        <div className="pt-2 relative" ref={profileMenuRef}>
          {/* Profile menu popover */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-30 animate-in fade-in slide-in-from-bottom-1 duration-100">
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  router.push('/admin/settings');
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                Settings
              </button>
              <div className="h-px bg-slate-100" />
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  handleLogout();
                }}
                disabled={isLoggingOut}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut className="w-3.5 h-3.5" />
                {isLoggingOut ? 'Logging out…' : 'Logout'}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-bold uppercase font-mono shadow-2xs">
                AD
              </div>
              <div className="min-w-0 text-left">
                <p className="text-xs font-semibold text-slate-800 truncate">Portfolio Admin</p>
                <p className="text-[10px] text-slate-500 truncate font-mono">
                  {publishedCount} of {projects.length} live
                </p>
              </div>
            </div>
            <ChevronUp
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${
                isProfileMenuOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>
        </div>
      </div>
    </aside>
  );
};
