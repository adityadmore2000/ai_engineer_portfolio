import {
  fallbackSiteSettings,
  fallbackExperiences,
  fallbackProjects,
  fallbackSkillCategories,
} from "../../sanity/fallbackContent";
import type {
  SanityExperience,
  SanityProject,
  SanitySiteSettings,
  SanitySkillCategory,
} from "./types";

export function fallbackToSanityProject(
  fb: (typeof fallbackProjects)[number]
): SanityProject {
  return {
    _id: fb._id,
    title: fb.title,
    slug: fb.slug || null,
    shortSummary: fb.shortSummary || null,
    status: fb.status || null,
    whyIBuiltIt: fb.whyIBuiltIt || null,
    theProblem: fb.theProblem || null,
    theSolution: fb.theSolution || null,
    engineeringDecisions: fb.engineeringDecisions || null,
    results: fb.results || null,
    whatThisDemonstrates: fb.whatThisDemonstrates || null,
    exampleInputsOutputs: fb.exampleInputsOutputs || null,
    lessonsLearned: fb.lessonsLearned || null,
    limitations: fb.limitations || null,
    futureImprovements: fb.futureImprovements || null,
    timeline: fb.timeline || null,
    technologies: fb.technologies || null,
    keyMetrics: fb.keyMetrics || null,
  };
}

export function fallbackToSanitySiteSettings(
  fb: typeof fallbackSiteSettings
): SanitySiteSettings {
  return {
    name: fb.name || null,
    shortBio: fb.shortBio || null,
    aboutSummary: fb.aboutSummary || null,
    focusAreas: fb.focusAreas || null,
    contactHeadline: fb.contactHeadline || null,
    contactDescription: fb.contactDescription || null,
    heroDescription: fb.heroDescription || null,
  };
}

export function fallbackToSanityExperience(
  fb: (typeof fallbackExperiences)[number]
): SanityExperience {
  return {
    _id: fb._id,
    role: fb.role || null,
    company: fb.company || null,
    shortDescription: fb.shortDescription || null,
    bulletPoints: fb.bulletPoints || null,
    skills: fb.skills || null,
  };
}

export function fallbackToSanitySkillCategory(
  fb: (typeof fallbackSkillCategories)[number]
): SanitySkillCategory {
  return {
    _id: fb._id,
    title: fb.title || null,
    skills: fb.skills || null,
  };
}
