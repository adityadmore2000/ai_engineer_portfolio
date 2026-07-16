"use client";

import { Bot, User } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import type { Message } from "./types";

function stripActionMarkers(text: string): string {
  return text
    .replace(/\[openResume\]/gi, "")
    .replace(/\[openProject:[^\]]+\]/gi, "")
    .replace(/\[scrollTo:[^\]]+\]/gi, "")
    .replace(/\[navigate:[^\]]+\]/gi, "")
    .trim();
}

export function ChatMessage({
  message,
  isStreaming,
}: {
  message: Message;
  isStreaming?: boolean;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-teal-800" : "bg-slate-200"
        }`}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-slate-700" />
        )}
      </div>

      <div
        className={`max-w-[85%] rounded-lg px-4 py-3 ${
          isUser
            ? "bg-teal-800 text-white"
            : "bg-white border border-slate-200 text-slate-900"
        }`}
      >
        <Markdown
          className={`prose-sm ${isUser ? "text-white" : "text-slate-900"}`}
        >
          {stripActionMarkers(message.content)}
        </Markdown>

        {isStreaming && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-teal-600 animate-pulse" />
        )}

        {message.evidence && message.evidence.length > 0 && !isUser && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Sources
            </p>
            <div className="space-y-1.5">
              {message.evidence.map((item, i) => (
                <a
                  key={i}
                  href={item.url || "#"}
                  target={item.url ? "_blank" : undefined}
                  rel={item.url ? "noreferrer" : undefined}
                  className="block rounded-md bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <span className="font-medium text-slate-800">
                    {item.projectTitle || "Portfolio"}
                  </span>
                  {item.section ? (
                    <span className="text-slate-400"> · {item.section}</span>
                  ) : null}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
