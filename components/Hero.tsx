import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { Markdown } from "./Markdown";
import { TrackLink } from "./Analytics";
import { AnalyticsEvents } from "@/lib/analytics";

export function Hero({ settings }: { settings?: SiteSettings | null }) {
  const primaryCtaText = settings?.primaryCtaText || "View Projects";

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
            <Markdown className="mt-10 max-w-xl text-lg leading-relaxed text-white/75 [&_a]:text-[#e36444] [&_strong]:text-white">
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
            {/* z-0: overhead studio spotlight — ellipse anchored top-center, casts downward */}
            <div
              className="pointer-events-none absolute inset-x-0 -top-[10%] z-0 h-[110%] blur-3xl"
              style={{
                background:
                  "radial-gradient(ellipse 75% 55% at 50% 0%, rgba(56,189,248,0.16), rgba(99,102,241,0.06) 45%, transparent 80%)",
              }}
              aria-hidden="true"
            />

            {/* z-10: portrait — top-border catches overhead light, bottom edge fades out */}
            <div
              className="relative z-10 aspect-[3/4] w-full overflow-hidden rounded-3xl border-t border-white/[0.15]"
              style={{
                maskImage: "linear-gradient(to top, transparent 0%, black 22%)",
                WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 22%)",
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
      className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-white/50 hover:text-white"
    >
      {icon}
    </TrackLink>
  );
}
