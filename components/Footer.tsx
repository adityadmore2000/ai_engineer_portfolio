import type { ReactNode } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";

export function Footer({ settings }: { settings?: SiteSettings | null }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-8 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-slate-950">{settings?.name || "Aditya More"}</p>
          {settings?.shortBio ? (
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {settings.shortBio}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-slate-500">
            © {currentYear} {settings?.name || "Aditya More"}. All rights reserved.
          </p>
        </div>
        <div className="flex gap-2">
          {settings?.linkedinUrl ? (
            <FooterLink href={settings.linkedinUrl} label="LinkedIn">
              <Linkedin aria-hidden="true" size={18} />
            </FooterLink>
          ) : null}
          {settings?.githubUrl ? (
            <FooterLink href={settings.githubUrl} label="GitHub">
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
  children
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
    >
      {children}
    </a>
  );
}
