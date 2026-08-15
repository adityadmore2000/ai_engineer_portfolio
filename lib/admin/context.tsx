'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { Project, Experience, AdminRoute, MaintenanceState } from './types';
import { INITIAL_EXPERIENCES } from './mock-data/experiences';
import { slugify } from './utils/slugify';
import {
  getAdminProjects,
  getAdminProject,
  saveProjectDraft as serverSaveProjectDraft,
  createProject as serverCreateProject,
  publishProject as serverPublishProject,
  unpublishProject as serverUnpublishProject,
  deleteProject as serverDeleteProject,
  type AdminProject,
} from '@/app/admin/actions/projects';

interface ToastInfo {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  subtitle?: string;
}

interface PortfolioContextType {
  projects: Project[];
  experiences: Experience[];
  maintenance: MaintenanceState;
  currentRoute: AdminRoute;
  activeProject: Project | null;
  toast: ToastInfo | null;
  searchQuery: string;
  statusFilter: string;
  sortBy: 'updated' | 'order' | 'title';
  hasUnsavedChanges: boolean;
  isCreateModalOpen: boolean;
  isLoading: boolean;
  error: string | null;

  updateMaintenance: (updates: Partial<MaintenanceState>) => void;

  navigateTo: (route: AdminRoute) => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (status: string) => void;
  setSortBy: (sort: 'updated' | 'order' | 'title') => void;
  dismissToast: () => void;
  showToast: (type: ToastInfo['type'], title: string, subtitle?: string) => void;

  getProjectById: (id: string) => Project | undefined;
  getProjectBySlug: (slug: string) => Project | undefined;
  createProject: (title: string, customSlug?: string) => Promise<Project>;
  updateActiveProject: (updater: Partial<Project> | ((prev: Project) => Project)) => void;
  saveDraft: () => Promise<void>;
  publishProject: (id?: string) => Promise<void>;
  unpublishProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<boolean>;
  discardUnsavedChanges: () => Promise<void>;
  refreshProjects: () => Promise<void>;

  createExperience: (exp: {
    companyName: string;
    role: string;
    duration: string;
    location: string;
    description: string;
  }) => Experience;
  updateExperience: (id: string, updated: Partial<Experience>) => void;
  deleteExperience: (id: string) => void;
  reorderExperiences: (newExperiences: Experience[]) => void;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const STORAGE_KEY_EXPERIENCES = 'portfolio_cms_experiences_v1';
const STORAGE_KEY_MAINTENANCE = 'portfolio_maintenance_v1';

const DEFAULT_MAINTENANCE: MaintenanceState = {
  enabled: false,
  message: 'Website update in progress — some features may be temporarily unavailable.',
  criticalLock: false,
};

function mapAdminProjectToProject(ap: AdminProject): Project {
  return {
    _id: ap._id,
    title: ap.title,
    slug: ap.slug,
    shortSummary: ap.shortSummary,
    coverImage: ap.coverImage
      ? { url: ap.coverImage.url, alt: ap.coverImage.alt ?? '', _ref: ap.coverImage.assetRef }
      : undefined,
    displayOrder: ap.displayOrder,
    technologies: ap.technologies,
    sections: ap.sections.map((s) => ({
      id: s._key,
      title: s.title,
      description: s.description ?? '',
    })),
    published: ap.published,
  };
}

function routeToPath(route: AdminRoute): string {
  switch (route.view) {
    case 'dashboard':
      return '/admin';
    case 'projects':
      return '/admin/projects';
    case 'project_new':
      return '/admin/projects';
    case 'project_edit':
      return `/admin/projects/${route.projectId}/edit`;
    case 'experience':
      return '/admin/experience';
    case 'preview':
      return `/admin/preview/${route.projectId}`;
  }
}

function currentRouteFromPathname(
  pathname: string,
  params: Record<string, string | string[]>
): AdminRoute {
  const id = typeof params.id === 'string' ? params.id : undefined;

  if (/^\/admin\/preview\//.test(pathname) && id) {
    return { view: 'preview', projectId: id };
  }
  if (/\/edit$/.test(pathname) && id) {
    return { view: 'project_edit', projectId: id };
  }
  if (pathname === '/admin/projects') {
    return { view: 'projects' };
  }
  if (pathname === '/admin/experience') {
    return { view: 'experience' };
  }
  return { view: 'dashboard' };
}

export const PortfolioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams() as Record<string, string | string[]>;

  const [projects, setProjects] = useState<Project[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>(INITIAL_EXPERIENCES);
  const [maintenance, setMaintenance] = useState<MaintenanceState>(DEFAULT_MAINTENANCE);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'updated' | 'order' | 'title'>('order');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentRoute = useMemo(
    () => currentRouteFromPathname(pathname, params),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname]
  );

  const refreshProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const adminProjects = await getAdminProjects();
      setProjects(adminProjects.map(mapAdminProjectToProject));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load projects from Sanity on mount
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Hydrate experiences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_EXPERIENCES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setExperiences(parsed);
        }
      }
    } catch {
      // Keep INITIAL_EXPERIENCES
    }
  }, []);

  // Persist experiences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_EXPERIENCES, JSON.stringify(experiences));
    } catch (e) {
      console.error('Failed to persist experiences', e);
    }
  }, [experiences]);

  // Hydrate maintenance from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MAINTENANCE);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && parsed !== null) {
          setMaintenance({ ...DEFAULT_MAINTENANCE, ...parsed });
        }
      }
    } catch {
      // Keep DEFAULT_MAINTENANCE
    }
  }, []);

  // Persist maintenance to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MAINTENANCE, JSON.stringify(maintenance));
    } catch (e) {
      console.error('Failed to persist maintenance state', e);
    }
  }, [maintenance]);

  // Synchronize activeProject when navigating to project_edit or preview
  useEffect(() => {
    if (currentRoute.view === 'project_edit') {
      const p = projects.find((item) => item._id === currentRoute.projectId);
      if (p) {
        setActiveProject({ ...p });
        setHasUnsavedChanges(false);
      }
    } else if (currentRoute.view === 'preview') {
      const p = projects.find((item) => item._id === currentRoute.projectId);
      if (p && !activeProject) {
        setActiveProject({ ...p });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoute, projects]);

  const updateMaintenance = useCallback((updates: Partial<MaintenanceState>) => {
    setMaintenance((prev) => ({ ...prev, ...updates }));
  }, []);

  const showToast = useCallback(
    (type: ToastInfo['type'], title: string, subtitle?: string) => {
      const id = Date.now().toString();
      setToast({ id, type, title, subtitle });
      setTimeout(() => {
        setToast((prev) => (prev?.id === id ? null : prev));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const navigateTo = useCallback(
    (route: AdminRoute) => {
      router.push(routeToPath(route));
    },
    [router]
  );

  const openCreateModal = useCallback(() => setIsCreateModalOpen(true), []);
  const closeCreateModal = useCallback(() => setIsCreateModalOpen(false), []);

  const getProjectById = useCallback(
    (id: string) => projects.find((p) => p._id === id),
    [projects]
  );

  const getProjectBySlug = useCallback(
    (slug: string) => projects.find((p) => p.slug === slug),
    [projects]
  );

  const createProject = useCallback(
    async (title: string, customSlug?: string): Promise<Project> => {
      const finalSlug =
        (customSlug && customSlug.trim()) || slugify(title) || 'untitled-project';

      try {
        const created = await serverCreateProject(title, finalSlug);
        const project = mapAdminProjectToProject(created);
        setProjects((prev) => [project, ...prev]);
        setActiveProject(project);
        setHasUnsavedChanges(false);
        showToast('success', 'Project created', `Slug: ${finalSlug} (Immutable)`);
        return project;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create project';
        showToast('error', 'Create failed', msg);
        throw e;
      }
    },
    [showToast]
  );

  const updateActiveProject = useCallback(
    (updater: Partial<Project> | ((prev: Project) => Project)) => {
      setActiveProject((prev) => {
        if (!prev) return null;
        return typeof updater === 'function'
          ? updater(prev)
          : { ...prev, ...updater };
      });
      setHasUnsavedChanges(true);
    },
    []
  );

  const saveDraft = useCallback(async () => {
    if (!activeProject) return;

    try {
      const saved = await serverSaveProjectDraft(activeProject._id, {
        title: activeProject.title,
        shortSummary: activeProject.shortSummary,
        coverImage: activeProject.coverImage?._ref
          ? { _ref: activeProject.coverImage._ref, alt: activeProject.coverImage.alt }
          : activeProject.coverImage?.alt !== undefined
          ? { alt: activeProject.coverImage.alt }
          : undefined,
        displayOrder: activeProject.displayOrder,
        technologies: activeProject.technologies,
        sections: activeProject.sections.map((s) => ({
          _key: s.id,
          title: s.title,
          description: s.description,
        })),
      });

      const updated = mapAdminProjectToProject(saved);
      setActiveProject(updated);
      setProjects((prev) => prev.map((p) => (p._id === updated._id ? updated : p)));
      setHasUnsavedChanges(false);
      showToast('info', 'Draft saved', 'Your changes are stored in Sanity.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save draft';
      showToast('error', 'Save failed', msg);
    }
  }, [activeProject, showToast]);

  const publishProject = useCallback(
    async (targetId?: string) => {
      const idToPublish = targetId || activeProject?._id;
      if (!idToPublish) return;

      try {
        await serverPublishProject(idToPublish);

        setProjects((prev) =>
          prev.map((p) =>
            p._id === idToPublish ? { ...p, published: true } : p
          )
        );

        if (activeProject?._id === idToPublish) {
          setActiveProject((prev) =>
            prev ? { ...prev, published: true } : null
          );
        }

        setHasUnsavedChanges(false);

        if (typeof window !== 'undefined') {
          import('canvas-confetti')
            .then(({ default: confetti }) => {
              confetti({
                particleCount: 80,
                spread: 60,
                origin: { y: 0.65 },
                colors: ['#6366f1', '#10b981', '#38bdf8', '#fbbf24', '#f43f5e'],
              });
            })
            .catch(() => {});
        }

        showToast('success', 'Published successfully', 'Project is now live on the public website.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to publish';
        showToast('error', 'Publish failed', msg);
      }
    },
    [activeProject, showToast]
  );

  const unpublishProject = useCallback(
    async (id: string) => {
      try {
        await serverUnpublishProject(id);

        setProjects((prev) =>
          prev.map((p) => (p._id === id ? { ...p, published: false } : p))
        );

        if (activeProject?._id === id) {
          setActiveProject((prev) =>
            prev ? { ...prev, published: false } : null
          );
        }

        showToast('info', 'Project unpublished', 'Removed from public site.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to unpublish';
        showToast('error', 'Unpublish failed', msg);
      }
    },
    [activeProject, showToast]
  );

  const deleteProject = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await serverDeleteProject(id);
        setProjects((prev) => prev.filter((p) => p._id !== id));
        if (activeProject?._id === id) {
          setActiveProject(null);
        }
        showToast('warning', 'Project deleted permanently');
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to delete';
        showToast('error', 'Delete failed', msg);
        return false;
      }
    },
    [activeProject, showToast]
  );

  const discardUnsavedChanges = useCallback(async () => {
    if (!activeProject) return;
    try {
      const fresh = await getAdminProject(activeProject._id);
      if (fresh) {
        const project = mapAdminProjectToProject(fresh);
        setActiveProject(project);
        setHasUnsavedChanges(false);
        showToast('info', 'Changes discarded', 'Reverted to last saved version.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to reload project';
      showToast('error', 'Discard failed', msg);
    }
  }, [activeProject, showToast]);

  const createExperience = useCallback(
    (expData: {
      companyName: string;
      role: string;
      duration: string;
      location: string;
      description: string;
    }): Experience => {
      const now = new Date().toISOString();
      const maxOrder = experiences.reduce(
        (max, e) => Math.max(max, e.displayOrder || 0),
        0
      );
      const newExp: Experience = {
        id: `exp-${Date.now()}`,
        companyName: expData.companyName.trim() || 'New Company',
        role: expData.role.trim() || 'Role Title',
        duration: expData.duration.trim() || 'Present',
        location: expData.location.trim() || 'Remote',
        description:
          expData.description.trim() ||
          '* Key responsibility or accomplishment\n* Another notable engineering impact',
        displayOrder: maxOrder + 1,
        createdAt: now,
        updatedAt: now,
      };

      setExperiences((prev) => [newExp, ...prev]);
      showToast('success', 'Experience added', `${newExp.companyName} — ${newExp.role}`);
      return newExp;
    },
    [experiences, showToast]
  );

  const updateExperience = useCallback(
    (id: string, updatedFields: Partial<Experience>) => {
      const now = new Date().toISOString();
      setExperiences((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...updatedFields, updatedAt: now } : e))
      );
      showToast('info', 'Experience updated');
    },
    [showToast]
  );

  const deleteExperience = useCallback(
    (id: string) => {
      setExperiences((prev) => prev.filter((e) => e.id !== id));
      showToast('warning', 'Experience deleted');
    },
    [showToast]
  );

  const reorderExperiences = useCallback((newExperiences: Experience[]) => {
    setExperiences(newExperiences);
  }, []);

  return (
    <PortfolioContext.Provider
      value={{
        projects,
        experiences,
        maintenance,
        currentRoute,
        activeProject,
        toast,
        searchQuery,
        statusFilter,
        sortBy,
        hasUnsavedChanges,
        isCreateModalOpen,
        isLoading,
        error,
        updateMaintenance,
        navigateTo,
        openCreateModal,
        closeCreateModal,
        setSearchQuery,
        setStatusFilter,
        setSortBy,
        dismissToast,
        showToast,
        getProjectById,
        getProjectBySlug,
        createProject,
        updateActiveProject,
        saveDraft,
        publishProject,
        unpublishProject,
        deleteProject,
        discardUnsavedChanges,
        refreshProjects,
        createExperience,
        updateExperience,
        deleteExperience,
        reorderExperiences,
      }}
    >
      {children}
    </PortfolioContext.Provider>
  );
};

export const usePortfolio = () => {
  const context = useContext(PortfolioContext);
  if (!context) {
    throw new Error('usePortfolio must be used within a PortfolioProvider');
  }
  return context;
};
