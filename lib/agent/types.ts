import type { SearchResult } from "@/lib/retrieval";

export type AgentAction = {
  type: "navigate" | "openProject" | "openResume" | "scrollTo";
  payload: string;
};

export type EvidencePackage = {
  context: string;
  sources: SearchResult[];
  truncated: boolean;
};

export type StreamEvent =
  | { type: "token"; content: string }
  | { type: "evidence"; data: SearchResult[] }
  | { type: "actions"; data: AgentAction[] }
  | { type: "error"; message: string }
  | { type: "done" };
