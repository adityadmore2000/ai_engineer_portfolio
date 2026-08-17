'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { Project, Experience, AdminRoute, MaintenanceState } from './types';
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
import {
  getAdminExperiences,
  createExperience as serverCreateExperience,
  updateExperience as serverUpdateExperience,
  deleteExperience as serverDeleteExperience,
  reorderExperiences as serverReorderExperiences,
  type CreateExperienceData,
  type UpdateExperienceData,
} from '@/app/admin/actions/experiences';
import {
  getSiteSettings as getAdminSiteSettings,
  updateSiteStateSettings,
} from '@/app/admin/actions/settings';

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

  updateMaintenance: (updates: Partial<MaintenanceState>) => Promise<void>;

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

  refreshExperiences: () => Promise<void>;
  createExperience: (data: CreateExperienceData) => Promise<Experience>;
  updateExperience: (id: string, data: UpdateExperienceData) => Promise<void>;
  deleteExperience: (id: string) => Promise<void>;
  reorderExperiences: (newExperiences: Experience[]) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

const DEFAULT_MAINTENANCE: MaintenanceState = {
  enabled: false,
  message: 'Website update in progress — some features may be temporarily unavailable.',
  criticalLock: false,
};

function mapAdminProjectToProject(ap: AdminProject): Project {
  return {
    _id: ap._id,
    _rev: ap._rev,
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
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceState>(DEFAULT_MAINTENANCE);
  const maintenanceRef = useRef<MaintenanceState>(DEFAULT_MAINTENANCE);
  const siteSettingsIdRef = useRef<string | null>(null);
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

  const refreshExperiences = useCallback(async () => {
    try {
      const data = await getAdminExperiences();
      setExperiences(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load experiences');
    }
  }, []);

  // Load projects and experiences from Sanity on mount
  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  useEffect(() => {
    refreshExperiences();
  }, [refreshExperiences]);

  // Sync maintenanceRef with state so updateMaintenance callback stays stable
  useEffect(() => {
    maintenanceRef.current = maintenance;
  }, [maintenance]);

  // Load maintenance state from Sanity on mount
  useEffect(() => {
    async function loadSiteSettings() {
      try {
        const settings = await getAdminSiteSettings();
        if (settings) {
          siteSettingsIdRef.current = settings._id;
          setMaintenance({
            enabled: settings.maintenanceEnabled ?? false,
            message: settings.maintenanceMessage ?? DEFAULT_MAINTENANCE.message,
            criticalLock: settings.criticalLock ?? false,
          });
        }
      } catch {
        // Keep DEFAULT_MAINTENANCE on load failure
      }
    }
    loadSiteSettings();
  }, []);

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

  const updateMaintenance = useCallback(async (updates: Partial<MaintenanceState>) => {
    const next = { ...maintenanceRef.current, ...updates };
    setMaintenance(next);
    if (siteSettingsIdRef.current) {
      await updateSiteStateSettings(siteSettingsIdRef.current, {
        maintenanceEnabled: next.enabled,
        maintenanceMessage: next.message,
        criticalLock: next.criticalLock,
      });
    }
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
        _rev: activeProject._rev,
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
      const isStale =
        e instanceof Error &&
        (e.message.includes('ifRevisionId') ||
          e.message.includes('revision') ||
          (e as { statusCode?: number }).statusCode === 409);
      if (isStale) {
        showToast(
          'warning',
          'Save conflict detected',
          'This project was modified elsewhere. Use Discard to reload the latest version.'
        );
      } else {
        const msg = e instanceof Error ? e.message : 'Failed to save draft';
        showToast('error', 'Save failed', msg);
      }
    }
  }, [activeProject, showToast]);

  const publishProject = useCallback(
    async (targetId?: string) => {
      const idToPublish = targetId || activeProject?._id;
      if (!idToPublish) return;

      try {
        const saved = await serverPublishProject(idToPublish);
        const updated = mapAdminProjectToProject(saved);

        setProjects((prev) =>
          prev.map((p) => (p._id === updated._id ? updated : p))
        );

        if (activeProject?._id === idToPublish) {
          setActiveProject(updated);
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
        const saved = await serverUnpublishProject(id);
        const updated = mapAdminProjectToProject(saved);

        setProjects((prev) =>
          prev.map((p) => (p._id === updated._id ? updated : p))
        );

        if (activeProject?._id === id) {
          setActiveProject(updated);
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
    async (data: CreateExperienceData): Promise<Experience> => {
      try {
        const created = await serverCreateExperience(data);
        setExperiences((prev) => [created, ...prev]);
        showToast('success', 'Experience added', `${created.company} — ${created.role}`);
        return created;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to create experience';
        showToast('error', 'Create failed', msg);
        throw e;
      }
    },
    [showToast]
  );

  const updateExperience = useCallback(
    async (id: string, data: UpdateExperienceData): Promise<void> => {
      try {
        const updated = await serverUpdateExperience(id, data);
        setExperiences((prev) => prev.map((e) => (e._id === id ? updated : e)));
        showToast('info', 'Experience updated');
      } catch (e) {
        const isStale =
          e instanceof Error &&
          (e.message.includes('ifRevisionId') ||
            e.message.includes('revision') ||
            (e as { statusCode?: number }).statusCode === 409);
        if (isStale) {
          showToast(
            'warning',
            'Save conflict detected',
            'This experience was modified elsewhere. Reload to get the latest version.'
          );
        } else {
          const msg = e instanceof Error ? e.message : 'Failed to update experience';
          showToast('error', 'Update failed', msg);
        }
        throw e;
      }
    },
    [showToast]
  );

  const deleteExperience = useCallback(
    async (id: string): Promise<void> => {
      try {
        await serverDeleteExperience(id);
        setExperiences((prev) => prev.filter((e) => e._id !== id));
        showToast('warning', 'Experience deleted');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to delete experience';
        showToast('error', 'Delete failed', msg);
        throw e;
      }
    },
    [showToast]
  );

  const reorderExperiences = useCallback(
    async (newExperiences: Experience[]): Promise<void> => {
      const reordered = newExperiences.map((e, i) => ({ ...e, displayOrder: i + 1 }));
      setExperiences(reordered);
      try {
        await serverReorderExperiences(
          reordered.map((e) => ({ _id: e._id, displayOrder: e.displayOrder! }))
        );
      } catch (e) {
        await refreshExperiences();
        const msg = e instanceof Error ? e.message : 'Reorder failed';
        showToast('error', 'Reorder failed', msg);
      }
    },
    [refreshExperiences, showToast]
  );

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
        refreshExperiences,
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
