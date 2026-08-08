import type { PortableTextBlock } from "next-sanity";

/**
 * Portable Text block for `project.content` (and derived narratives). An
 * optional `anchor` stores the `{#id}` heading marker's value; consumers fall
 * back to the slugified heading when absent (Phase 3).
 */
export type ContentBlock = PortableTextBlock & { anchor?: string };

export type SanityImage = {
  url?: string;
  alt?: string;
};

export type ResumeFile = {
  url?: string;
};

export type SiteSettings = {
  _id: string;
  name: string;
  role?: string;
  shortBio?: string;
  heroDescription?: string;
  profileImage?: SanityImage;
  email?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  resumeFile?: ResumeFile;
  resumeUrl?: string;
  location?: string;
  availabilityText?: string;
  heroMetrics?: string[];
  headerCtaText?: string;
  primaryCtaText?: string;
  secondaryCtaText?: string;
  emailCtaText?: string;
  resumeCtaText?: string;
  aboutSummary?: string;
  focusAreas?: string[];
  contactHeadline?: string;
  contactDescription?: string;
  seoTitle?: string;
  seoDescription?: string;
};

export type ExperienceItem = {
  _id: string;
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
};

export type ProjectSummary = {
  _id: string;
  title: string;
  slug?: string;
  shortSummary?: string;
  coverImage?: SanityImage;
  technologies?: string[];
  keyMetrics?: string[];
  githubUrl?: string;
  demoUrl?: string;
  featured?: boolean;
  displayOrder?: number;
  published?: boolean;
  status?: string;
};

export type ProjectDetail = ProjectSummary & {
  /** Derived narrative representation (published from the repo docs/ source). */
  content?: ContentBlock[];
};

export type ProjectDocumentationPage = {
  _id: string;
  title: string;
  slug?: string;
  description?: string;
  body?: PortableTextBlock[];
  order?: number;
  showInNavigation?: boolean;
  showInExploreMore?: boolean;
  statusLabel?: string;
  project?: {
    _id: string;
    title?: string;
    slug?: string;
  };
  projectRef?: string;
  parentPage?: {
    _id: string;
    title?: string;
    slug?: string;
  };
  seoTitle?: string;
  seoDescription?: string;
  socialImage?: SanityImage;
};

export type SkillCategory = {
  _id: string;
  title: string;
  skills?: string[];
  displayOrder?: number;
};

export type TechnicalNoteSummary = {
  _id: string;
  title: string;
  slug?: string;
  shortSummary?: string;
  tags?: string[];
  publishedDate?: string;
  featured?: boolean;
  coverImage?: SanityImage;
};

export type TechnicalNoteDetail = TechnicalNoteSummary & {
  content?: ContentBlock[];
};
