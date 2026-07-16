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
};
