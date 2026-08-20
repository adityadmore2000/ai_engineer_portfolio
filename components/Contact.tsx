"use client";

import { ArrowUpRight, Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { TrackLink } from "./Analytics";
import { AnalyticsEvents } from "@/lib/analytics";

export function Contact({ settings }: { settings?: SiteSettings | null }) {
  if (!settings) return null;

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

        {settings.email ? (
          <TrackLink
            href={`mailto:${settings.email}`}
            event={AnalyticsEvents.ContactAction}
            metadata={{ method: "email_cta" }}
            className="flex-shrink-0 self-start md:self-auto"
            aria-label="Book a call via email"
          >
            <span className="inline-flex h-28 w-28 flex-col items-center justify-center rounded-full bg-[var(--color-coral,#e36444)] text-white shadow-[0_8px_30px_rgba(227,100,68,0.4)] transition-transform hover:scale-105 md:h-36 md:w-36">
              <span className="text-center text-xs font-bold uppercase leading-tight tracking-wide">
                Book<br />A Call
              </span>
              <ArrowUpRight size={18} className="mt-1" />
            </span>
          </TrackLink>
        ) : null}
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        {settings.email ? (
          <TrackLink
            href={`mailto:${settings.email}`}
            event={AnalyticsEvents.ContactAction}
            metadata={{ method: "email" }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-[var(--color-dark,#121315)] transition-colors hover:bg-gray-50"
          >
            <Mail size={15} />
            {settings.email}
          </TrackLink>
        ) : null}

        {settings.linkedinUrl ? (
          <TrackLink
            href={settings.linkedinUrl}
            target="_blank"
            rel="noreferrer"
            event={AnalyticsEvents.ExternalClick}
            metadata={{ destination: "linkedin" }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-[var(--color-dark,#121315)] transition-colors hover:bg-gray-50"
          >
            <Linkedin size={15} />
            LinkedIn
          </TrackLink>
        ) : null}

        {settings.githubUrl ? (
          <TrackLink
            href={settings.githubUrl}
            target="_blank"
            rel="noreferrer"
            event={AnalyticsEvents.ExternalClick}
            metadata={{ destination: "github" }}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-5 py-2.5 text-sm font-semibold text-[var(--color-dark,#121315)] transition-colors hover:bg-gray-50"
          >
            <Github size={15} />
            GitHub
          </TrackLink>
        ) : null}
      </div>
    </section>
  );
}
