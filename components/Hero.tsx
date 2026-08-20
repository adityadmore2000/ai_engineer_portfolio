import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { getResumeHref } from "@/sanity/utils";
import { Markdown } from "./Markdown";
import { TrackLink } from "./Analytics";
import { AnalyticsEvents } from "@/lib/analytics";

export function Hero({ settings }: { settings?: SiteSettings | null }) {
  const resumeHref = getResumeHref(settings);
  const primaryCtaText = settings?.primaryCtaText || "View Projects";
  const secondaryCtaText = settings?.secondaryCtaText || "Download Resume";

  if (!settings) {
    return (
      <section className="flex min-h-screen items-center bg-[#121315] px-[var(--section-padding-x)] pt-20">
        <div className="rounded-lg border border-dashed border-white/20 p-8">
          <h1 className="text-3xl font-bold text-white">
            Portfolio content is ready for Sanity.
          </h1>
          <p className="mt-3 max-w-2xl text-white/60">
            Configure the Sanity environment variables and add the initial site
            settings document in Studio to publish the live portfolio content.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      id="home"
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#121315] px-[var(--section-padding-x)] pt-24 pb-0"
    >
      {/* Main content grid */}
      <div className="flex flex-1 flex-col justify-center">
      <div className="grid gap-12 py-16 lg:grid-cols-[1fr_400px] lg:items-center">
        {/* Left: text content */}
        <div>
          <span className="pill-badge label-mono border-white/20 text-white/70">
            {settings.role || "Applied AI Engineer"}
          </span>

          <h1 className="heading-display mt-8 text-[clamp(2.25rem,7vw,4.5rem)] leading-[1] text-white">
            {settings.name}
          </h1>

          {settings.heroDescription ? (
            <Markdown className="mt-6 max-w-xl text-lg leading-relaxed text-[#9ca3af] [&_a]:text-[#e36444] [&_strong]:text-white">
              {settings.heroDescription}
            </Markdown>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/#projects"
              className="inline-flex items-center justify-center rounded-full bg-[#e36444] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#cf5535]"
            >
              {primaryCtaText}
            </Link>
            {resumeHref ? (
              <TrackLink
                href={resumeHref}
                target="_blank"
                rel="noreferrer"
                event={AnalyticsEvents.FileDownload}
                metadata={{ file: "resume", format: "pdf" }}
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white/60"
              >
                {secondaryCtaText}
              </TrackLink>
            ) : null}
          </div>

          <div className="mt-7 flex gap-3">
            {settings.linkedinUrl ? (
              <SocialIcon
                href={settings.linkedinUrl}
                label="LinkedIn"
                icon={<Linkedin size={18} />}
                event={AnalyticsEvents.ExternalClick}
                metadata={{ destination: "linkedin" }}
              />
            ) : null}
            {settings.githubUrl ? (
              <SocialIcon
                href={settings.githubUrl}
                label="GitHub"
                icon={<Github size={18} />}
                event={AnalyticsEvents.ExternalClick}
                metadata={{ destination: "github" }}
              />
            ) : null}
            {settings.email ? (
              <SocialIcon
                href={`mailto:${settings.email}`}
                label="Email"
                icon={<Mail size={18} />}
              />
            ) : null}
          </div>
        </div>

        {/* Right: profile image */}
        {settings.profileImage?.url ? (
          <div className="relative mx-auto w-full max-w-sm lg:max-w-none">
            {/* Layer 0: architectural node/graph SVG — extends slightly past container */}
            <svg
              className="pointer-events-none absolute z-0"
              style={{ top: "-10%", left: "-8%", width: "116%", height: "116%" }}
              viewBox="0 0 480 640"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Outer hull lines */}
              <line x1="60"  y1="90"  x2="210" y2="40"  stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="210" y1="40"  x2="360" y2="120" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="360" y1="120" x2="430" y2="240" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="430" y1="240" x2="440" y2="400" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="440" y1="400" x2="360" y2="550" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="360" y1="550" x2="200" y2="600" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="200" y1="600" x2="60"  y2="490" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="60"  y1="490" x2="20"  y2="300" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="20"  y1="300" x2="60"  y2="90"  stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round"/>
              {/* Inner cluster — cyan accent edges */}
              <line x1="60"  y1="90"  x2="170" y2="190" stroke="rgba(34,211,238,0.14)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="170" y1="190" x2="270" y2="145" stroke="rgba(34,211,238,0.14)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="270" y1="145" x2="360" y2="120" stroke="rgba(34,211,238,0.12)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="210" y1="40"  x2="270" y2="145" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="170" y1="190" x2="290" y2="290" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="290" y1="290" x2="430" y2="240" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="290" y1="290" x2="350" y2="400" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="350" y1="400" x2="440" y2="400" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="350" y1="400" x2="360" y2="550" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="290" y1="290" x2="205" y2="400" stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="205" y1="400" x2="60"  y2="490" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="205" y1="400" x2="200" y2="600" stroke="rgba(255,255,255,0.05)" strokeWidth="0.8" strokeLinecap="round"/>
              {/* Left-side cyan accent path */}
              <line x1="20"  y1="300" x2="100" y2="370" stroke="rgba(34,211,238,0.10)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="100" y1="370" x2="205" y2="400" stroke="rgba(34,211,238,0.10)" strokeWidth="0.8" strokeLinecap="round"/>
              {/* Nodes */}
              <circle cx="60"  cy="90"  r="2.5" fill="rgba(255,255,255,0.15)"/>
              <circle cx="210" cy="40"  r="2"   fill="rgba(255,255,255,0.10)"/>
              <circle cx="360" cy="120" r="2.5" fill="rgba(255,255,255,0.15)"/>
              <circle cx="430" cy="240" r="2"   fill="rgba(255,255,255,0.10)"/>
              <circle cx="440" cy="400" r="2"   fill="rgba(255,255,255,0.10)"/>
              <circle cx="360" cy="550" r="2"   fill="rgba(255,255,255,0.10)"/>
              <circle cx="200" cy="600" r="2"   fill="rgba(255,255,255,0.08)"/>
              <circle cx="60"  cy="490" r="2.5" fill="rgba(255,255,255,0.12)"/>
              <circle cx="20"  cy="300" r="2"   fill="rgba(255,255,255,0.10)"/>
              <circle cx="170" cy="190" r="3"   fill="rgba(34,211,238,0.22)"/>
              <circle cx="290" cy="290" r="3"   fill="rgba(34,211,238,0.22)"/>
              <circle cx="205" cy="400" r="2.5" fill="rgba(255,255,255,0.12)"/>
              <circle cx="350" cy="400" r="2"   fill="rgba(255,255,255,0.10)"/>
              <circle cx="100" cy="370" r="2"   fill="rgba(34,211,238,0.15)"/>
              <circle cx="270" cy="145" r="2"   fill="rgba(255,255,255,0.12)"/>
            </svg>

            {/* Layer 1: portrait — floats on top, bottom edge fades into background */}
            <div
              className="relative z-10 aspect-[3/4] w-full overflow-hidden rounded-[24px]"
              style={{
                maskImage: "linear-gradient(to top, transparent 0%, black 20%)",
                WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 20%)",
              }}
            >
              <Image
                src={settings.profileImage.url}
                alt={settings.profileImage.alt || `${settings.name} profile image`}
                fill
                className="object-cover object-top"
                priority
              />
            </div>
          </div>
        ) : null}
      </div>
      </div>

      {/* Scroll transition: subtle gradient to ease into the next section */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 h-20 bg-gradient-to-b from-transparent to-white/[0.03]" />
    </section>
  );
}

function SocialIcon({
  href,
  label,
  icon,
  event,
  metadata,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  event?: string;
  metadata?: Record<string, string>;
}) {
  return (
    <TrackLink
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      event={event}
      metadata={metadata}
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/50 hover:text-white"
    >
      {icon}
    </TrackLink>
  );
}
