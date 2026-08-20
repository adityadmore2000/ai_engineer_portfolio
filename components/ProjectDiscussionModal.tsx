"use client";

import { useEffect, useRef } from "react";
import { X, ArrowUpRight, Mail } from "lucide-react";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

interface ProjectDiscussionModalProps {
  isOpen: boolean;
  onClose: () => void;
  calendlyUrl?: string | null;
  email?: string | null;
  modalDescription?: string;
}

export function ProjectDiscussionModal({
  isOpen,
  onClose,
  calendlyUrl,
  email,
  modalDescription,
}: ProjectDiscussionModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSchedule = () => {
    if (!calendlyUrl) return;
    trackEvent(AnalyticsEvents.ExternalClick, { destination: "calendly", method: "project_discussion_modal" });
    window.open(calendlyUrl, "_blank", "noopener,noreferrer");
  };

  const handleEmail = () => {
    if (!email) return;
    trackEvent(AnalyticsEvents.ContactAction, { method: "project_discussion_modal_email" });
    window.location.href = `mailto:${email}?subject=Project Discussion`;
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <X size={16} />
        </button>

        <p className="label-mono mb-4 text-[var(--color-gray-500,#6b7280)]">
          Let&apos;s Work Together
        </p>

        <h2
          id="modal-title"
          className="mb-4 text-[var(--color-dark,#121315)]"
          style={{
            fontFamily: "var(--font-outfit, sans-serif)",
            fontWeight: 900,
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            lineHeight: 1.1,
          }}
        >
          Discuss a Project
        </h2>

        <p className="mb-8 text-sm leading-relaxed text-gray-600">
          {modalDescription ||
            "Have an AI project, a technical problem, or an idea you'd like to explore? Let's have a focused 30-minute conversation to understand what you're building and figure out how I can help."}
        </p>

        <div className="flex flex-col gap-3">
          {calendlyUrl ? (
            <button
              type="button"
              onClick={handleSchedule}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-coral,#e36444)] px-6 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(227,100,68,0.35)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Schedule a Meeting
              <ArrowUpRight size={15} />
            </button>
          ) : null}

          {email ? (
            <button
              type="button"
              onClick={handleEmail}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-gray-200 px-6 py-3.5 text-sm font-semibold text-[var(--color-dark,#121315)] transition-colors hover:bg-gray-50"
            >
              <Mail size={15} />
              Email Me
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
