export type ProjectStatus =
  | 'Active'
  | 'Completed'
  | 'Archived'
  | 'Proof of Concept'
  | 'In Development';

export type PublicationState =
  | 'draft'
  | 'published'
  | 'published_with_draft_changes';

export interface ProjectSection {
  id: string;
  title: string;
  description: string;
}

export interface MetricItem {
  id: string;
  text: string;
  value?: string;
  label?: string;
}

export interface ProjectLinks {
  github?: string;
  demo?: string;
  videoDemo?: string;
}

export interface Project {
  id: string;
  title: string;
  slug: string; // Immutable after creation
  shortSummary: string;
  status: ProjectStatus;
  publicationState: PublicationState;
  displayOrder: number;
  technologies: string[];
  sections: ProjectSection[];
  links?: ProjectLinks;
  metrics?: MetricItem[];
  coverImage?: {
    url: string;
    alt: string;
  };
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  lastDraftSavedAt?: string;
  hasUnsavedChanges?: boolean;
}

export interface Experience {
  id: string;
  companyName: string;
  role: string;
  duration: string;
  location: string;
  description: string;
  displayOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type AdminRoute =
  | { view: 'dashboard' }
  | { view: 'projects' }
  | { view: 'project_new' }
  | { view: 'project_edit'; projectId: string }
  | { view: 'experience' }
  | { view: 'preview'; projectId: string; isLivePublic?: boolean };
