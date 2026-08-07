import type { ReactNode } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { getResumeHref } from "@/sanity/utils";
import { Markdown } from "./Markdown";
import { SectionShell } from "./SectionShell";
import { TrackLink } from "./Analytics";
import { AnalyticsEvents } from "@/lib/analytics";

export function Contact({ settings }: { settings?: SiteSettings | null }) {
  if (!settings) {
    return null;
  }

  const resumeHref = getResumeHref(settings);
  const emailCtaText = settings.emailCtaText || "Email Me";
  const resumeCtaText = settings.resumeCtaText || "Download Resume";

  return (
    <SectionShell
      id="contact"
      eyebrow="Contact"
      title={settings.contactHeadline}
    >
      {settings.contactDescription ? (
        <Markdown className="mb-10 max-w-3xl text-lg text-slate-700">
          {settings.contactDescription}
        </Markdown>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {settings.email ? (
          <TrackLink
            href={`mailto:${settings.email}`}
            event={AnalyticsEvents.ContactAction}
            metadata={{ method: "email" }}
            className="inline-flex items-center gap-2 rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
          >
            <Mail aria-hidden="true" size={17} />
            {emailCtaText}
          </TrackLink>
        ) : null}
        {settings.linkedinUrl ? (
          <ContactLink href={settings.linkedinUrl} label="LinkedIn" icon={<Linkedin size={17} />} event={AnalyticsEvents.ExternalClick} metadata={{ destination: "linkedin" }} />
        ) : null}
        {settings.githubUrl ? (
          <ContactLink href={settings.githubUrl} label="GitHub" icon={<Github size={17} />} event={AnalyticsEvents.ExternalClick} metadata={{ destination: "github" }} />
        ) : null}
        {resumeHref ? (
          <ContactLink href={resumeHref} label={resumeCtaText} event={AnalyticsEvents.FileDownload} metadata={{ file: "resume", format: "pdf" }} />
        ) : null}
      </div>
    </SectionShell>
  );
}

function ContactLink({
  href,
  label,
  icon,
  event,
  metadata
}: {
  href: string;
  label: string;
  icon?: ReactNode;
  event?: string;
  metadata?: Record<string, string>;
}) {
  return (
    <TrackLink
      href={href}
      target="_blank"
      rel="noreferrer"
      event={event}
      metadata={metadata}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
    >
      {icon}
      {label}
    </TrackLink>
  );
}
