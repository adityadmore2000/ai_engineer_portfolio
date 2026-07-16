"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Message, ChatAction } from "./types";

type ChatContextValue = {
  messages: Message[];
  isOpen: boolean;
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  toggleChat: () => void;
  closeChat: () => void;
  clearChat: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: data.content || "I'm not sure how to respond to that.",
        evidence: data.evidence || [],
        actions: data.actions || [],
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (data.actions?.length) {
        executeClientActions(data.actions);
      }
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          role: "assistant",
          content:
            "I'm sorry, I encountered an error. Please try again.",
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages]);

  const toggleChat = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        isOpen,
        isLoading,
        sendMessage,
        toggleChat,
        closeChat,
        clearChat,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

function executeClientActions(actions: ChatAction[]) {
  for (const action of actions) {
    switch (action.type) {
      case "openResume":
        if (action.payload) {
          window.open(action.payload, "_blank");
        }
        break;
      case "openProject":
        if (action.payload) {
          window.open(`/projects/${action.payload}`, "_self");
        }
        break;
      case "scrollTo": {
        const el = document.getElementById(action.payload);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
        break;
      }
      case "navigate":
        if (action.payload) {
          window.open(action.payload, "_blank");
        }
        break;
    }
  }
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
