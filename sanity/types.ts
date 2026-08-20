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
  maintenanceEnabled?: boolean;
  maintenanceMessage?: string;
  criticalLock?: boolean;
  showAiChat?: boolean;
  introductionVideoUrl?: string;
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
  displayOrder?: number;
  published?: boolean;
};

export type ProjectSection = {
  _key: string;
  title: string;
  description?: string;
};

export type MediaAsset = {
  refId: string;
  alt?: string;
  caption?: string;
  url?: string;
};

export type ProjectDetail = ProjectSummary & {
  sections?: ProjectSection[];
  mediaAssets?: MediaAsset[];
};

export type SkillCategory = {
  _id: string;
  title: string;
  skills?: string[];
  displayOrder?: number;
};

export type WorkingProcessStep = {
  _id: string;
  title: string;
  description?: string;
  stepNumber: number;
  displayOrder?: number;
};

export type BlogPost = {
  _id: string;
  title: string;
  slug?: string;
  summary?: string;
  coverImage?: SanityImage;
  publishedAt?: string;
  displayOrder?: number;
  published?: boolean;
};

export type FaqItem = {
  _id: string;
  question: string;
  answer?: string;
  displayOrder?: number;
};

