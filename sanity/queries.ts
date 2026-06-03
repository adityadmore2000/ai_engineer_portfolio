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
  displayOrder
`;

export const featuredProjectsQuery = groq`
  *[_type == "project" && featured == true] | order(coalesce(displayOrder, 999) asc, title asc) {
    ${projectSummaryFields}
  }
`;

export const allProjectsQuery = groq`
  *[_type == "project"] | order(coalesce(displayOrder, 999) asc, title asc) {
    ${projectSummaryFields}
  }
`;

export const projectBySlugQuery = groq`
  *[_type == "project" && slug.current == $slug][0] {
    ${projectSummaryFields},
    problemStatement,
    approach,
    results,
    limitations,
    futureImprovements,
    architectureImage{${imageFields}},
    screenshots[]{${imageFields}},
    detailedContent
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

export async function getSiteSettings() {
  return sanityFetch<SiteSettings>({ query: siteSettingsQuery });
}

export async function getExperiences() {
  return (
    (await sanityFetch<ExperienceItem[]>({ query: experiencesQuery })) || []
  );
}

export async function getFeaturedProjects() {
  return (
    (await sanityFetch<ProjectSummary[]>({ query: featuredProjectsQuery })) || []
  );
}

export async function getAllProjects() {
  return (await sanityFetch<ProjectSummary[]>({ query: allProjectsQuery })) || [];
}

export async function getProjectBySlug(slug: string) {
  return sanityFetch<ProjectDetail>({
    query: projectBySlugQuery,
    params: { slug }
  });
}

export async function getProjectDocumentationPagesByProjectSlug(
  projectSlug: string,
  projectId = ""
) {
  return (
    (await sanityFetch<ProjectDocumentationPage[]>({
      query: projectDocumentationPagesByProjectSlugQuery,
      params: { projectSlug, projectId }
    })) || []
  );
}

export async function getSkillCategories() {
  return (
    (await sanityFetch<SkillCategory[]>({ query: skillCategoriesQuery })) || []
  );
}

export async function getFeaturedTechnicalNotes() {
  return (
    (await sanityFetch<TechnicalNoteSummary[]>({
      query: featuredTechnicalNotesQuery
    })) || []
  );
}

export async function getAllTechnicalNotes() {
  return (
    (await sanityFetch<TechnicalNoteSummary[]>({
      query: allTechnicalNotesQuery
    })) || []
  );
}

export async function getTechnicalNoteBySlug(slug: string) {
  return sanityFetch<TechnicalNoteDetail>({
    query: technicalNoteBySlugQuery,
    params: { slug }
  });
}
