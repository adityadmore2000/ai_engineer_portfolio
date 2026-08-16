export interface ProjectSection {
  id: string;
  title: string;
  description: string;
}

export interface ProjectImage {
  url: string;
  alt: string;
  _ref?: string;
}

export interface Project {
  _id: string;
  _rev?: string;
  title: string;
  slug: string;
  shortSummary: string;
  coverImage?: ProjectImage;
  displayOrder: number;
  technologies: string[];
  sections: ProjectSection[];
  published: boolean;
  hasUnsavedChanges?: boolean;
}

export interface Experience {
  _id: string;
  _rev?: string;
  role: string;
  company: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  currentRole?: boolean;
  shortDescription?: string;
  bulletPoints?: string[];
  skills?: string[];
  displayOrder?: number;
}

export type AdminRoute =
  | { view: 'dashboard' }
  | { view: 'projects' }
  | { view: 'project_new' }
  | { view: 'project_edit'; projectId: string }
  | { view: 'experience' }
  | { view: 'preview'; projectId: string; isLivePublic?: boolean };

export interface MaintenanceState {
  enabled: boolean;
  message: string;
  criticalLock: boolean;
}
