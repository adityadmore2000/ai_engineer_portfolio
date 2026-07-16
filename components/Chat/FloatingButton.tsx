"use client";

import { MessageCircle, X } from "lucide-react";
import { useChat } from "./ChatProvider";

export function FloatingButton() {
  const { toggleChat, isOpen } = useChat();

  return (
    <button
      type="button"
      onClick={toggleChat}
      aria-label={isOpen ? "Close chat" : "Open chat"}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-teal-800 text-white shadow-lg hover:bg-teal-900 transition-all hover:scale-105 active:scale-95"
    >
      {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
    </button>
  );
}
