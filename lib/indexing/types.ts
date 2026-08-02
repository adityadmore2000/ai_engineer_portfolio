import { groq } from "next-sanity";
import type { PortableTextBlock } from "next-sanity";

export type SanityProject = {
  _id: string;
  title: string;
  slug: string | null;
  shortSummary: string | null;
  status: string | null;
  technologies: string[] | null;
  keyMetrics: string[] | null;
  content?: PortableTextBlock[] | null;
};

export type SanitySiteSettings = {
  name: string | null;
  shortBio: string | null;
  aboutSummary: string | null;
  focusAreas: string[] | null;
  contactHeadline: string | null;
  contactDescription: string | null;
  heroDescription: string | null;
};

export type SanityExperience = {
  _id: string;
  role: string | null;
  company: string | null;
  shortDescription: string | null;
  bulletPoints: string[] | null;
  skills: string[] | null;
};

export type SanitySkillCategory = {
  _id: string;
  title: string | null;
  skills: string[] | null;
};

export type SanityTechnicalNote = {
  _id: string;
  title: string | null;
  slug: string | null;
  shortSummary: string | null;
  tags: string[] | null;
};

export const projectsQuery = groq`*[_type == "project" && published == true] { _id, title, "slug": slug.current, shortSummary, status, technologies, keyMetrics, content }`;

export const siteSettingsQuery = groq`*[_type == "siteSettings"][0] { name, shortBio, aboutSummary, focusAreas, contactHeadline, contactDescription, heroDescription }`;

export const experiencesQuery = groq`*[_type == "experience"] { _id, role, company, shortDescription, bulletPoints, skills }`;

export const skillCategoriesQuery = groq`*[_type == "skillCategory"] { _id, title, skills }`;

export const technicalNotesQuery = groq`*[_type == "technicalNote" && defined(publishedDate)] { _id, title, "slug": slug.current, shortSummary, tags }`;
