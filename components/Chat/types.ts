export type Evidence = {
  content: string;
  projectTitle?: string;
  slug?: string;
  section?: string;
  url?: string;
  score?: number;
};

export type ChatAction = {
  type: "navigate" | "openProject" | "openResume" | "scrollTo";
  payload: string;
};

export type SseEvent =
  | { type: "token"; content: string }
  | { type: "evidence"; data: Evidence[] }
  | { type: "actions"; data: ChatAction[] }
  | { type: "error"; message: string }
  | { type: "done" };

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  evidence?: Evidence[];
  actions?: ChatAction[];
  createdAt: Date;
};

export type ChatState = {
  messages: Message[];
  isOpen: boolean;
  isLoading: boolean;
  isStreaming: boolean;
};
