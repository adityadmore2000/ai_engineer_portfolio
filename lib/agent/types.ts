import type { SearchResult } from "@/lib/retrieval";

export type AgentAction = {
  type: "navigate" | "openProject" | "openResume" | "scrollTo";
  payload: string;
};

export type AgentOutput = {
  content: string;
  evidence: SearchResult[];
  actions: AgentAction[];
};
