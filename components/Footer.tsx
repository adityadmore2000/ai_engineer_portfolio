import type { ReactNode } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { Markdown } from "./Markdown";
import { TrackLink } from "./Analytics";
import type { ClickAnalyticsEvent } from "@/lib/analytics";

export function Footer({ settings }: { settings?: SiteSettings | null }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-8 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-slate-950">{settings?.name || "Aditya More"}</p>
          {settings?.shortBio ? (
            <Markdown className="mt-1 max-w-2xl text-sm text-slate-600">
              {settings.shortBio}
            </Markdown>
          ) : null}
          <p className="mt-2 text-sm text-slate-500">
            © {currentYear} {settings?.name || "Aditya More"}. All rights reserved.
          </p>
        </div>
        <div className="flex gap-2">
          {settings?.linkedinUrl ? (
            <FooterLink href={settings.linkedinUrl} label="LinkedIn" event="linkedin_click">
              <Linkedin aria-hidden="true" size={18} />
            </FooterLink>
          ) : null}
          {settings?.githubUrl ? (
            <FooterLink href={settings.githubUrl} label="GitHub" event="github_click">
              <Github aria-hidden="true" size={18} />
            </FooterLink>
          ) : null}
          {settings?.email ? (
            <FooterLink href={`mailto:${settings.email}`} label="Email">
              <Mail aria-hidden="true" size={18} />
            </FooterLink>
          ) : null}
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  label,
  children,
  event
}: {
  href: string;
  label: string;
  children: ReactNode;
  event?: ClickAnalyticsEvent;
}) {
  return (
    <TrackLink
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      aria-label={label}
      event={event}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
    >
      {children}
    </TrackLink>
  );
}
