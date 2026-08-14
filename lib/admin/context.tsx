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
import {
  Project,
  Experience,
  AdminRoute,
  PublicationState,
  ProjectStatus,
  MaintenanceState,
} from './types';
import { INITIAL_PROJECTS } from './mock-data/projects';
import { INITIAL_EXPERIENCES } from './mock-data/experiences';
import { slugify } from './utils/slugify';

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
  createProject: (title: string, customSlug?: string) => Project;
  updateActiveProject: (updater: Partial<Project> | ((prev: Project) => Project)) => void;
  saveDraft: () => void;
  publishProject: (id?: string) => void;
  archiveProject: (id: string) => void;
  unarchiveProject: (id: string) => void;
  deleteProject: (id: string) => boolean;
  discardUnsavedChanges: () => void;
  resetAllToMockData: () => void;

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

const STORAGE_KEY_PROJECTS = 'portfolio_cms_projects_v2';
const STORAGE_KEY_EXPERIENCES = 'portfolio_cms_experiences_v1';
const STORAGE_KEY_MAINTENANCE = 'portfolio_maintenance_v1';

const DEFAULT_MAINTENANCE: MaintenanceState = {
  enabled: false,
  message: 'Website update in progress — some features may be temporarily unavailable.',
  criticalLock: false,
};

function routeToPath(route: AdminRoute): string {
  switch (route.view) {
    case 'dashboard':
      return '/admin';
    case 'projects':
      return '/admin/projects';
    case 'project_new':
      // Modal triggered from projects list — stay on that page
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

  // SSR-safe: initialize with defaults, hydrate from localStorage on mount
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [experiences, setExperiences] = useState<Experience[]>(INITIAL_EXPERIENCES);
  const [maintenance, setMaintenance] = useState<MaintenanceState>(DEFAULT_MAINTENANCE);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [toast, setToast] = useState<ToastInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'updated' | 'order' | 'title'>('updated');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Derive currentRoute from URL (memoized so effect deps are stable)
  const currentRoute = useMemo(
    () => currentRouteFromPathname(pathname, params),
    // params is tied to pathname — depend only on pathname
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pathname]
  );

  // Hydrate projects from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PROJECTS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].sections) {
          setProjects(parsed);
        }
      }
    } catch {
      // Keep INITIAL_PROJECTS
    }
  }, []);

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

  // Persist projects to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    } catch (e) {
      console.error('Failed to persist projects', e);
    }
  }, [projects]);

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
      const p = projects.find((item) => item.id === currentRoute.projectId);
      if (p) {
        setActiveProject({ ...p });
        setHasUnsavedChanges(false);
      }
    } else if (currentRoute.view === 'preview') {
      const p = projects.find((item) => item.id === currentRoute.projectId);
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
    (id: string) => projects.find((p) => p.id === id),
    [projects]
  );

  const getProjectBySlug = useCallback(
    (slug: string) => projects.find((p) => p.slug === slug),
    [projects]
  );

  const createProject = useCallback(
    (title: string, customSlug?: string): Project => {
      const finalSlug =
        (customSlug && customSlug.trim()) || slugify(title) || 'untitled-project';
      const now = new Date().toISOString();
      const maxOrder = projects.reduce(
        (max, p) => Math.max(max, p.displayOrder || 0),
        0
      );

      const newProject: Project = {
        id: `proj-${Date.now()}`,
        title: title.trim() || 'Untitled Project',
        slug: finalSlug,
        shortSummary:
          'A concise summary of the engineering challenge and what was built.',
        status: 'In Development',
        publicationState: 'draft',
        displayOrder: maxOrder + 1,
        technologies: ['TypeScript', 'React'],
        links: {},
        metrics: [],
        sections: [
          {
            id: `sec-${Date.now()}-1`,
            title: 'Context & Motivation',
            description:
              'Explain why you initiated this project, the origin story, and the core problem being solved.',
          },
          {
            id: `sec-${Date.now()}-2`,
            title: 'System Architecture',
            description:
              'Outline the high-level architecture, key technical components, and data flow.',
          },
        ],
        coverImage: {
          url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1400&q=80',
          alt: title || 'Project Cover Image',
        },
        createdAt: now,
        updatedAt: now,
        lastDraftSavedAt: now,
      };

      setProjects((prev) => [newProject, ...prev]);
      setActiveProject(newProject);
      setHasUnsavedChanges(false);
      showToast('success', 'Project created', `Slug: ${finalSlug} (Immutable)`);
      return newProject;
    },
    [projects, showToast]
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

  const saveDraft = useCallback(() => {
    if (!activeProject) return;
    const now = new Date().toISOString();

    let newPubState: PublicationState = activeProject.publicationState;
    if (activeProject.publicationState === 'published') {
      newPubState = 'published_with_draft_changes';
    }

    const updated: Project = {
      ...activeProject,
      publicationState: newPubState,
      updatedAt: now,
      lastDraftSavedAt: now,
      hasUnsavedChanges: false,
    };

    setActiveProject(updated);
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setHasUnsavedChanges(false);
    showToast('info', 'Draft saved just now', 'Your changes are stored and available in preview.');
  }, [activeProject, showToast]);

  const publishProject = useCallback(
    (targetId?: string) => {
      const idToPublish = targetId || activeProject?.id;
      if (!idToPublish) return;

      const now = new Date().toISOString();

      setProjects((prev) =>
        prev.map((p) => {
          if (p.id === idToPublish) {
            const base =
              activeProject?.id === idToPublish ? activeProject : p;
            return {
              ...base,
              publicationState: 'published' as PublicationState,
              publishedAt: now,
              updatedAt: now,
              lastDraftSavedAt: now,
              hasUnsavedChanges: false,
            };
          }
          return p;
        })
      );

      if (activeProject?.id === idToPublish) {
        setActiveProject((prev) =>
          prev
            ? {
                ...prev,
                publicationState: 'published',
                publishedAt: now,
                updatedAt: now,
                lastDraftSavedAt: now,
                hasUnsavedChanges: false,
              }
            : null
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
    },
    [activeProject, showToast]
  );

  const archiveProject = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: 'Archived' as ProjectStatus, updatedAt: now } : p
        )
      );
      if (activeProject?.id === id) {
        setActiveProject((prev) =>
          prev ? { ...prev, status: 'Archived' as ProjectStatus, updatedAt: now } : null
        );
      }
      showToast('info', 'Project archived', 'Moved to archived projects filter.');
    },
    [activeProject, showToast]
  );

  const unarchiveProject = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: 'Active' as ProjectStatus, updatedAt: now } : p
        )
      );
      if (activeProject?.id === id) {
        setActiveProject((prev) =>
          prev ? { ...prev, status: 'Active' as ProjectStatus, updatedAt: now } : null
        );
      }
      showToast('success', 'Project restored', 'Status changed to Active.');
    },
    [activeProject, showToast]
  );

  const deleteProject = useCallback(
    (id: string): boolean => {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProject?.id === id) {
        setActiveProject(null);
      }
      showToast('warning', 'Project deleted permanently');
      return true;
    },
    [activeProject, showToast]
  );

  const discardUnsavedChanges = useCallback(() => {
    if (!activeProject) return;
    const original = projects.find((p) => p.id === activeProject.id);
    if (original) {
      setActiveProject({ ...original });
      setHasUnsavedChanges(false);
      showToast('info', 'Changes discarded', 'Reverted to last saved version.');
    }
  }, [activeProject, projects, showToast]);

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

  const resetAllToMockData = useCallback(() => {
    setProjects(INITIAL_PROJECTS);
    setExperiences(INITIAL_EXPERIENCES);
    setActiveProject(null);
    setHasUnsavedChanges(false);
    router.push('/admin');
    showToast('info', 'Reset all sample projects and experiences');
  }, [router, showToast]);

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
        archiveProject,
        unarchiveProject,
        deleteProject,
        discardUnsavedChanges,
        resetAllToMockData,
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
