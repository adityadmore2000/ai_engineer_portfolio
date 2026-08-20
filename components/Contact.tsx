"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ContactSettings, SiteSettings } from "@/sanity/types";
import { ProjectDiscussionModal } from "./ProjectDiscussionModal";

const DEFAULT_SECTION_DESCRIPTION =
  "Have something you're building, exploring, or trying to solve? I'm open to conversations around AI engineering, ML systems, and interesting technical problems.";

const DEFAULT_MODAL_DESCRIPTION =
  "Have an AI project, a technical problem, or an idea you'd like to explore? Let's have a focused 30-minute conversation to understand what you're building and figure out how I can help.";

interface ContactProps {
  settings?: SiteSettings | null;
  contactSettings?: ContactSettings | null;
}

export function Contact({ settings, contactSettings }: ContactProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!settings) return null;

  const sectionDescription =
    contactSettings?.sectionDescription || DEFAULT_SECTION_DESCRIPTION;
  const modalDescription =
    contactSettings?.modalDescription || DEFAULT_MODAL_DESCRIPTION;

  return (
    <section
      id="contact"
      className="w-full bg-white"
      style={{
        paddingTop: "var(--section-padding-y, 100px)",
        paddingBottom: "var(--section-padding-y, 100px)",
        paddingLeft: "var(--section-padding-x, 80px)",
        paddingRight: "var(--section-padding-x, 80px)"
      }}
    >
      <p className="label-mono mb-6 text-[var(--color-gray-500,#6b7280)]">Get in Touch</p>

      <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
        <h2
          className="heading-display text-[var(--color-dark,#121315)]"
          style={{ fontSize: "clamp(3rem, 10vw, 6.875rem)", lineHeight: 0.9 }}
        >
          LET&apos;S<br />TALK NOW
        </h2>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Let's connect"
          className="flex-shrink-0 self-start md:self-auto"
        >
          <span className="inline-flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[var(--color-coral,#e36444)] text-white shadow-[0_8px_30px_rgba(227,100,68,0.4)] transition-transform hover:scale-105 md:h-36 md:w-36">
            <span className="text-center text-xs font-bold uppercase leading-tight tracking-wide">
              Let&apos;s<br />Connect
            </span>
            <ArrowUpRight size={18} className="mt-1" />
          </span>
        </button>
      </div>

      <p className="mt-10 max-w-xl text-base leading-relaxed text-[var(--color-gray-500,#6b7280)]">
        {sectionDescription}
      </p>

      <ProjectDiscussionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        calendlyUrl={contactSettings?.calendlyUrl}
        email={settings.email}
        modalDescription={modalDescription}
      />
    </section>
  );
}
