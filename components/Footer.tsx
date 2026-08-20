import Link from "next/link";
import { Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { TrackLink } from "./Analytics";
import { AnalyticsEvents } from "@/lib/analytics";

const NAV_LINKS = [
  { label: "Works", href: "/#projects" },
  { label: "About", href: "/#about" },
  { label: "Experience", href: "/#experience" },
  { label: "Contact", href: "/#contact" },
];

const UTILITY_PAGES = [
  { label: "Projects", href: "/projects" },
];

export function Footer({ settings }: { settings?: SiteSettings | null }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="w-full bg-[var(--color-dark,#121315)]"
      style={{
        paddingTop: "var(--section-padding-y, 100px)",
        paddingBottom: "40px",
        paddingLeft: "var(--section-padding-x, 80px)",
        paddingRight: "var(--section-padding-x, 80px)"
      }}
    >
      <div className="grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-8">
        {/* Left: Nav links */}
        <div>
          <p className="label-mono mb-6 text-[var(--color-gray-400,#9ca3af)]">Navigation</p>
          <nav className="flex flex-col gap-2">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-white transition-colors hover:text-[var(--color-coral,#e36444)]"
                style={{
                  fontFamily: "var(--font-outfit, sans-serif)",
                  fontWeight: 900,
                  fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
                  textTransform: "uppercase",
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1
                }}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Center: Quick Contact + Office Location */}
        <div>
          <div className="mb-8">
            <p className="label-mono mb-4 text-[var(--color-gray-400,#9ca3af)]">Quick Contact</p>
            {settings?.email ? (
              <TrackLink
                href={`mailto:${settings.email}`}
                event={AnalyticsEvents.ContactAction}
                metadata={{ method: "footer_email" }}
                className="inline-flex items-center gap-2 text-sm text-white transition-colors hover:text-[var(--color-coral,#e36444)]"
              >
                <Mail size={15} />
                {settings.email}
              </TrackLink>
            ) : null}
          </div>

        </div>

        {/* Right: Follow Me + Utility Pages */}
        <div>
          <div className="mb-8">
            <p className="label-mono mb-4 text-[var(--color-gray-400,#9ca3af)]">Follow Me</p>
            <div className="flex flex-col gap-2">
              {settings?.linkedinUrl ? (
                <TrackLink
                  href={settings.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  event={AnalyticsEvents.ExternalClick}
                  metadata={{ destination: "linkedin" }}
                  className="inline-flex items-center gap-2 text-sm text-white transition-colors hover:text-[var(--color-coral,#e36444)]"
                >
                  <Linkedin size={15} />
                  LinkedIn
                </TrackLink>
              ) : null}

              {settings?.githubUrl ? (
                <TrackLink
                  href={settings.githubUrl}
                  target="_blank"
                  rel="noreferrer"
                  event={AnalyticsEvents.ExternalClick}
                  metadata={{ destination: "github" }}
                  className="inline-flex items-center gap-2 text-sm text-white transition-colors hover:text-[var(--color-coral,#e36444)]"
                >
                  <Github size={15} />
                  GitHub
                </TrackLink>
              ) : null}
            </div>
          </div>

          <div>
            <p className="label-mono mb-2 text-[var(--color-gray-400,#9ca3af)]">Utility Pages</p>
            <div className="flex flex-col gap-1">
              {UTILITY_PAGES.map((page) => (
                <Link
                  key={page.href}
                  href={page.href}
                  className="text-sm text-[var(--color-gray-400,#9ca3af)] transition-colors hover:text-white"
                >
                  {page.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16 border-t border-white/10 pt-8">
        <p className="text-sm text-[var(--color-gray-500,#6b7280)]">
          © {currentYear} {settings?.name || "Aditya More"}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
