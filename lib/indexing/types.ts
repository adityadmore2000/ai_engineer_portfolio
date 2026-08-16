import { groq } from "next-sanity";

export type SanityProjectSection = {
  _key: string;
  title: string;
  description: string | null;
};

export type SanityProject = {
  _id: string;
  title: string;
  slug: string | null;
  shortSummary: string | null;
  technologies: string[] | null;
  sections: SanityProjectSection[] | null;
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

export const projectsQuery = groq`*[_type == "project" && published == true] { _id, title, "slug": slug.current, shortSummary, technologies, sections[]{ _key, title, description } }`;

export const siteSettingsQuery = groq`*[_type == "siteSettings"][0] { name, shortBio, aboutSummary, focusAreas, contactHeadline, contactDescription, heroDescription }`;

export const experiencesQuery = groq`*[_type == "experience"] { _id, role, company, shortDescription, bulletPoints, skills }`;

export const skillCategoriesQuery = groq`*[_type == "skillCategory"] { _id, title, skills }`;
