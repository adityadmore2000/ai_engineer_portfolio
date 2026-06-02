import type { ReactNode } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { getResumeHref } from "@/sanity/utils";
import { SectionShell } from "./SectionShell";

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
      description={settings.contactDescription}
    >
      <div className="flex flex-wrap gap-3">
        {settings.email ? (
          <a
            href={`mailto:${settings.email}`}
            className="inline-flex items-center gap-2 rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
          >
            <Mail aria-hidden="true" size={17} />
            {emailCtaText}
          </a>
        ) : null}
        {settings.linkedinUrl ? (
          <ContactLink href={settings.linkedinUrl} label="LinkedIn" icon={<Linkedin size={17} />} />
        ) : null}
        {settings.githubUrl ? (
          <ContactLink href={settings.githubUrl} label="GitHub" icon={<Github size={17} />} />
        ) : null}
        {resumeHref ? (
          <ContactLink href={resumeHref} label={resumeCtaText} />
        ) : null}
      </div>
    </SectionShell>
  );
}

function ContactLink({
  href,
  label,
  icon
}: {
  href: string;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
    >
      {icon}
      {label}
    </a>
  );
}
