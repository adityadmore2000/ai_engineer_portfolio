import type { SearchResult } from "./types";
import { searchByTechnology, getContactInfo, getExperience, getSkills, getResumeUrl, getProjectBySlugFromSanity } from "./structured";
import { searchSemantic } from "./semantic";

export type { SearchResult } from "./types";

const STRUCTURED_PATTERNS: { pattern: RegExp; handler: (match: RegExpMatchArray) => Promise<SearchResult[]> }[] = [
  {
    pattern: /which projects use\s+(.+)/i,
    handler: async (match) => searchByTechnology(match[1].trim()),
  },
  {
    pattern: /(?:what|which).*(?:technology|technologies|skill|skills|tools|framework|library|stack).*(?:used|use|work(?:ed)?\s*(?:with|on)?)/i,
    handler: async () => {
      const skills = await getSkills();
      const projects = await searchByTechnology("");
      return [...skills, ...projects];
    },
  },
  {
    pattern: /(?:contact|email|linkedin|github|reach|get in touch|message)/i,
    handler: async () => getContactInfo(),
  },
  {
    pattern: /(?:resume|cv|curriculum vitae)/i,
    handler: async () => {
      const url = await getResumeUrl();
      if (url) {
        return [{ content: `Resume is available at: ${url}`, section: "Resume", url }];
      }
      const contact = await getContactInfo();
      return contact.filter((r) => r.section === "Resume" || r.section === "Contact");
    },
  },
  {
    pattern: /(?:experience|work history|employment|previous role|past role|career)/i,
    handler: async () => getExperience(),
  },
  {
    pattern: /(?:skill|expertise|proficient|tech stack|technologies)/i,
    handler: async () => getSkills(),
  },
  {
    pattern: /^open\s+(.+)/i,
    handler: async (match) => {
      const target = match[1].trim().toLowerCase();
      if (target.includes("resume") || target.includes("cv")) {
        const url = await getResumeUrl();
        if (url) {
          return [{ content: `Opening resume: ${url}`, section: "Resume", url }];
        }
      }
      return [];
    },
  },
  {
    pattern: /^(?:explain|tell me about|describe|show)\s+(?:the\s+)?(.+)/i,
    handler: async (match) => {
      const target = match[1].trim().toLowerCase();
      const query = groqQuery(target);
      if (query) {
        return getProjectBySlugFromSanity(query);
      }
      return [];
    },
  },
];

function groqQuery(target: string): string | null {
  const slugMap: Record<string, string> = {
    "video captioning agent": "video-captioning-agent",
    "resume tailoring": "evidence-grounded-resume-tailoring-platform",
    "resume tailoring platform": "evidence-grounded-resume-tailoring-platform",
    "parcel monitoring": "warehouse-parcel-monitoring-system",
    "warehouse parcel monitoring": "warehouse-parcel-monitoring-system",
    "math mentor": "math-mentor-ai",
    "math mentor ai": "math-mentor-ai",
  };

  for (const [key, slug] of Object.entries(slugMap)) {
    if (target.includes(key)) return slug;
  }
  return null;
}

export async function searchPortfolio(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();

  for (const { pattern, handler } of STRUCTURED_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      const results = await handler(match);
      if (results.length > 0) return results;
    }
  }

  return searchSemantic(trimmed);
}
