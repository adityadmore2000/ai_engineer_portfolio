import { client } from "../../sanity/client";
import { isSanityConfigured } from "../../sanity/env";
import {
  fallbackSiteSettings,
  fallbackExperiences,
  fallbackProjects,
  fallbackSkillCategories,
} from "../../sanity/fallbackContent";
import {
  fallbackToSanityExperience,
  fallbackToSanityProject,
  fallbackToSanitySiteSettings,
  fallbackToSanitySkillCategory,
} from "./adapters";
import {
  experiencesQuery,
  projectsQuery,
  siteSettingsQuery,
  skillCategoriesQuery,
} from "./types";
import type {
  SanityExperience,
  SanityProject,
  SanitySiteSettings,
  SanitySkillCategory,
} from "./types";

export async function fetchFromSanity() {
  console.log("Fetching content from Sanity...");
  return Promise.all([
    client.fetch<SanityProject[]>(projectsQuery),
    client.fetch<SanitySiteSettings>(siteSettingsQuery),
    client.fetch<SanityExperience[]>(experiencesQuery),
    client.fetch<SanitySkillCategory[]>(skillCategoriesQuery),
  ]);
}

export function getFallbackContent() {
  console.log("Sanity is not configured. Using fallback content...");
  const projects: SanityProject[] = fallbackProjects.map(fallbackToSanityProject);
  const settings: SanitySiteSettings = fallbackToSanitySiteSettings(fallbackSiteSettings);
  const experiences: SanityExperience[] = fallbackExperiences.map(fallbackToSanityExperience);
  const skillCategories: SanitySkillCategory[] =
    fallbackSkillCategories.map(fallbackToSanitySkillCategory);

  return [projects, settings, experiences, skillCategories] as const;
}

export async function getContent() {
  return isSanityConfigured ? await fetchFromSanity() : getFallbackContent();
}
