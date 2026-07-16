"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { Send } from "lucide-react";

export function ChatInput({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput() {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
      <textarea
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder="Ask about the portfolio..."
        rows={1}
        disabled={disabled}
        className="min-h-[40px] max-h-[120px] flex-1 resize-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        aria-label="Send message"
      >
        <Send size={18} />
      </button>
    </div>
  );
}
