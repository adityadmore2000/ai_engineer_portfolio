import { groq } from "next-sanity";
import { sanityFetch } from "./client";
import type {
  ExperienceItem,
  ProjectDetail,
  ProjectSummary,
  SiteSettings,
  SkillCategory
} from "./types";

type SanityFetchParams = Record<string, string | number | boolean>;
type SanityFetcher = <QueryResponse>({
  query,
  params
}: {
  query: string;
  params?: SanityFetchParams;
}) => Promise<QueryResponse | null>;

const imageFields = `
  "url": asset->url,
  "alt": coalesce(alt, asset->altText)
`;

export const siteSettingsQuery = groq`
  *[_type == "siteSettings"][0]{
    _id,
    name,
    role,
    shortBio,
    heroDescription,
    profileImage{${imageFields}},
    email,
    linkedinUrl,
    githubUrl,
    resumeFile{"url": asset->url},
    resumeUrl,
    location,
    availabilityText,
    heroMetrics,
    headerCtaText,
    primaryCtaText,
    secondaryCtaText,
    emailCtaText,
    resumeCtaText,
    aboutSummary,
    focusAreas,
    contactHeadline,
    contactDescription,
    seoTitle,
    seoDescription,
    maintenanceEnabled,
    maintenanceMessage,
    criticalLock,
    showAiChat,
    introductionVideoUrl
  }
`;

export const experiencesQuery = groq`
  *[_type == "experience"] | order(coalesce(displayOrder, 999) asc, startDate desc) {
    _id,
    role,
    company,
    location,
    startDate,
    endDate,
    currentRole,
    shortDescription,
    bulletPoints,
    skills,
    displayOrder
  }
`;

const projectSummaryFields = `
  _id,
  title,
  "slug": slug.current,
  shortSummary,
  coverImage{${imageFields}},
  technologies,
  displayOrder,
  published
`;

export const allProjectsQuery = groq`
  *[_type == "project" && published == true] | order(coalesce(displayOrder, 999) asc, title asc) {
    ${projectSummaryFields}
  }
`;

export const projectBySlugQuery = groq`
  *[_type == "project" && slug.current == $slug && published == true][0] {
    _id,
    title,
    "slug": slug.current,
    shortSummary,
    coverImage{${imageFields}},
    technologies,
    displayOrder,
    published,
    sections[]{ _key, title, description },
    mediaAssets[]{ refId, alt, caption, "url": asset.asset->url }
  }
`;

export const skillCategoriesQuery = groq`
  *[_type == "skillCategory"] | order(coalesce(displayOrder, 999) asc, title asc) {
    _id,
    title,
    skills,
    displayOrder
  }
`;

export async function getSiteSettings(fetcher: SanityFetcher = sanityFetch) {
  return fetcher<SiteSettings>({ query: siteSettingsQuery });
}

export async function getExperiences(fetcher: SanityFetcher = sanityFetch) {
  return (
    (await fetcher<ExperienceItem[]>({ query: experiencesQuery })) || []
  );
}

export async function getAllProjects(fetcher: SanityFetcher = sanityFetch) {
  return (await fetcher<ProjectSummary[]>({ query: allProjectsQuery })) || [];
}

export async function getProjectBySlug(
  slug: string,
  fetcher: SanityFetcher = sanityFetch
) {
  return fetcher<ProjectDetail>({
    query: projectBySlugQuery,
    params: { slug }
  });
}

export async function getSkillCategories(fetcher: SanityFetcher = sanityFetch) {
  return (
    (await fetcher<SkillCategory[]>({ query: skillCategoriesQuery })) || []
  );
}
