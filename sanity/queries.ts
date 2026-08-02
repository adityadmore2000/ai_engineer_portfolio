import { groq } from "next-sanity";
import { sanityFetch } from "./client";
import type {
  ExperienceItem,
  ProjectDocumentationPage,
  ProjectDetail,
  ProjectSummary,
  SiteSettings,
  SkillCategory,
  TechnicalNoteDetail,
  TechnicalNoteSummary
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
    seoDescription
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
  keyMetrics,
  githubUrl,
  demoUrl,
  featured,
  displayOrder,
  published,
  status
`;

export const featuredProjectsQuery = groq`
  *[_type == "project" && featured == true && published == true] | order(coalesce(displayOrder, 999) asc, title asc) {
    ${projectSummaryFields}
  }
`;

export const allProjectsQuery = groq`
  *[_type == "project" && published == true] | order(coalesce(displayOrder, 999) asc, title asc) {
    ${projectSummaryFields}
  }
`;

export const projectBySlugQuery = groq`
  *[_type == "project" && slug.current == $slug && published == true][0] {
    ${projectSummaryFields},
    content
  }
`;

export const projectDocumentationPagesByProjectSlugQuery = groq`
  *[
    _type == "projectDocumentationPage" &&
    (
      project->slug.current == $projectSlug ||
      project._ref == $projectId
    )
  ] | order(coalesce(order, 0) asc, title asc) {
    _id,
    title,
    "slug": slug.current,
    description,
    body,
    "order": coalesce(order, 0),
    "showInNavigation": coalesce(showInNavigation, true),
    "showInExploreMore": coalesce(showInExploreMore, true),
    statusLabel,
    project->{
      _id,
      title,
      "slug": slug.current
    },
    "projectRef": project._ref,
    parentPage->{
      _id,
      title,
      "slug": slug.current
    },
    seoTitle,
    seoDescription,
    socialImage{${imageFields}}
  }
`;

export const allProjectDocumentationPagesQuery = groq`
  *[_type == "projectDocumentationPage"] | order(coalesce(order, 0) asc, title asc) {
    _id,
    title,
    "slug": slug.current,
    description,
    body,
    "order": coalesce(order, 0),
    "showInNavigation": coalesce(showInNavigation, true),
    "showInExploreMore": coalesce(showInExploreMore, true),
    statusLabel,
    project->{
      _id,
      title,
      "slug": slug.current
    },
    "projectRef": project._ref,
    parentPage->{
      _id,
      title,
      "slug": slug.current
    },
    seoTitle,
    seoDescription,
    socialImage{${imageFields}}
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

const noteSummaryFields = `
  _id,
  title,
  "slug": slug.current,
  shortSummary,
  tags,
  publishedDate,
  featured,
  coverImage{${imageFields}}
`;

export const featuredTechnicalNotesQuery = groq`
  *[_type == "technicalNote" && featured == true && defined(publishedDate)] | order(publishedDate desc) {
    ${noteSummaryFields}
  }
`;

export const allTechnicalNotesQuery = groq`
  *[_type == "technicalNote" && defined(publishedDate)] | order(publishedDate desc) {
    ${noteSummaryFields}
  }
`;

export const technicalNoteBySlugQuery = groq`
  *[_type == "technicalNote" && slug.current == $slug && defined(publishedDate)][0] {
    ${noteSummaryFields},
    content
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

export async function getFeaturedProjects(fetcher: SanityFetcher = sanityFetch) {
  return (
    (await fetcher<ProjectSummary[]>({ query: featuredProjectsQuery })) || []
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

export async function getProjectDocumentationPagesByProjectSlug(
  projectSlug: string,
  projectId = "",
  fetcher: SanityFetcher = sanityFetch
) {
  return (
    (await fetcher<ProjectDocumentationPage[]>({
      query: projectDocumentationPagesByProjectSlugQuery,
      params: { projectSlug, projectId }
    })) || []
  );
}

export async function getAllProjectDocumentationPages(
  fetcher: SanityFetcher = sanityFetch
) {
  return (
    (await fetcher<ProjectDocumentationPage[]>({
      query: allProjectDocumentationPagesQuery
    })) || []
  );
}

export async function getSkillCategories(fetcher: SanityFetcher = sanityFetch) {
  return (
    (await fetcher<SkillCategory[]>({ query: skillCategoriesQuery })) || []
  );
}

export async function getFeaturedTechnicalNotes(
  fetcher: SanityFetcher = sanityFetch
) {
  return (
    (await fetcher<TechnicalNoteSummary[]>({
      query: featuredTechnicalNotesQuery
    })) || []
  );
}

export async function getAllTechnicalNotes(fetcher: SanityFetcher = sanityFetch) {
  return (
    (await fetcher<TechnicalNoteSummary[]>({
      query: allTechnicalNotesQuery
    })) || []
  );
}

export async function getTechnicalNoteBySlug(
  slug: string,
  fetcher: SanityFetcher = sanityFetch
) {
  return fetcher<TechnicalNoteDetail>({
    query: technicalNoteBySlugQuery,
    params: { slug }
  });
}
