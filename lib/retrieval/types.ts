export type SearchResult = {
  content: string;
  projectTitle?: string;
  slug?: string;
  section?: string;
  url?: string;
  score?: number;
};

export enum RetrievalStrategy {
  Structured = "structured",
  Semantic = "semantic",
}

export type RetrievalQuery = {
  text: string;
  strategy?: RetrievalStrategy;
};
