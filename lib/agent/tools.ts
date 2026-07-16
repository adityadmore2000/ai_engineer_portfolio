import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchPortfolio } from "@/lib/retrieval";
import { getProjectBySlugFromSanity, getResumeUrl, getContactInfo } from "@/lib/retrieval/structured";

export const searchTool = tool(
  async ({ query }) => {
    const results = await searchPortfolio(query);

    if (results.length === 0) {
      return JSON.stringify({
        results: [],
        message: "No relevant portfolio content found for this query.",
      });
    }

    return JSON.stringify({ results });
  },
  {
    name: "search_portfolio",
    description:
      "Search the portfolio for information about projects, skills, experience, contact details, and more. Use this for most user questions.",
    schema: z.object({
      query: z.string().describe("The search query or question from the user"),
    }),
  }
);

export const projectDetailTool = tool(
  async ({ slug }) => {
    const results = await getProjectBySlugFromSanity(slug);

    if (results.length === 0) {
      return JSON.stringify({
        results: [],
        message: `No project found with slug "${slug}".`,
      });
    }

    return JSON.stringify({ results });
  },
  {
    name: "get_project_detail",
    description:
      "Get detailed information about a specific project by its slug. Use this when the user asks about a specific project in detail.",
    schema: z.object({
      slug: z.string().describe("The project slug (e.g., 'video-captioning-agent')"),
    }),
  }
);

export const resumeTool = tool(
  async () => {
    const url = await getResumeUrl();
    return JSON.stringify({
      url,
      message: url
        ? `Resume is available at: ${url}`
        : "No resume URL is configured.",
    });
  },
  {
    name: "get_resume_url",
    description:
      "Get the URL to Aditya's resume. Use this when the user asks for the resume or CV.",
    schema: z.object({}),
  }
);

export const contactTool = tool(
  async () => {
    const info = await getContactInfo();
    return JSON.stringify({ results: info });
  },
  {
    name: "get_contact_info",
    description:
      "Get contact information including email, LinkedIn, GitHub, and location. Use this when the user asks how to reach or contact Aditya.",
    schema: z.object({}),
  }
);

export const tools = [searchTool, projectDetailTool, resumeTool, contactTool];
