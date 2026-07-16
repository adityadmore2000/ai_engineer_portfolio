"use client";

import { useEffect, useRef } from "react";
import { X, Trash2 } from "lucide-react";
import { useChat } from "./ChatProvider";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ExamplePrompts } from "./ExamplePrompts";

export function SlideOutPanel() {
  const { messages, isOpen, isLoading, isStreaming, closeChat, sendMessage, clearChat } =
    useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  const streamingMessageId =
    isStreaming && messages.length > 0
      ? messages[messages.length - 1]?.id
      : undefined;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:bg-transparent md:pointer-events-none"
          onClick={closeChat}
        />
      )}

      <div
        className={`fixed bottom-24 right-6 z-50 flex w-[380px] flex-col rounded-xl border border-slate-200 bg-[var(--background)] shadow-2xl transition-all duration-300 md:bottom-6 ${
          isOpen
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-4 opacity-0 pointer-events-none"
        }`}
        style={{ maxHeight: "min(600px, 80vh)" }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-800">
              <span className="text-xs font-bold text-white">AM</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Portfolio Assistant
              </p>
              <p className="text-xs text-slate-400">
                Ask me anything about the portfolio
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clearChat}
              aria-label="Clear chat"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={closeChat}
              aria-label="Close"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50">
                <span className="text-xl font-bold text-teal-800">AM</span>
              </div>
              <p className="text-center text-sm text-slate-600">
                Hi! I am Aditya More&apos;s portfolio assistant.
                <br />
                Ask me anything about projects, skills, or experience.
              </p>
              <ExamplePrompts onSelect={sendMessage} />
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isStreaming={message.id === streamingMessageId}
                />
              ))}

              {isLoading && !isStreaming && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200">
                    <span className="text-xs font-bold text-slate-500">AI</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-4 py-3">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <ChatInput onSend={sendMessage} disabled={isLoading || isStreaming} />
      </div>
    </>
  );
}
