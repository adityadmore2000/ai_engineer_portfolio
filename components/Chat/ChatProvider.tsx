"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type { Message, ChatAction, SseEvent } from "./types";

type ChatContextValue = {
  messages: Message[];
  isOpen: boolean;
  isLoading: boolean;
  isStreaming: boolean;
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
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const sendMessage = useCallback(async (text: string) => {
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: text,
      createdAt: new Date(),
    };

    const assistantId = generateId();

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsStreaming(false);

    try {
      const apiMessages = [...messagesRef.current, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
      setIsStreaming(true);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const event: SseEvent = JSON.parse(trimmed.slice(6));

            switch (event.type) {
              case "token":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.content }
                      : m
                  )
                );
                break;
              case "evidence":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, evidence: event.data }
                      : m
                  )
                );
                break;
              case "actions":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, actions: event.data }
                      : m
                  )
                );
                if (event.data.length) {
                  executeClientActions(event.data);
                }
                break;
              case "error":
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: event.message }
                      : m
                  )
                );
                break;
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);

      setMessages((prev) => [
        ...prev,
        {
          id: assistantId || generateId(),
          role: "assistant",
          content: "I'm sorry, I encountered an error. Please try again.",
          createdAt: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, []);

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
        isStreaming,
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
