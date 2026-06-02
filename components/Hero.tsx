import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { Github, Linkedin, Mail } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { getResumeHref } from "@/sanity/utils";

export function Hero({ settings }: { settings?: SiteSettings | null }) {
  const resumeHref = getResumeHref(settings);
  const primaryCtaText = settings?.primaryCtaText || "View Projects";
  const secondaryCtaText = settings?.secondaryCtaText || "Download Resume";

  if (!settings) {
    return (
      <section className="px-5 py-20 md:px-8">
        <div className="mx-auto max-w-6xl rounded-lg border border-dashed border-slate-300 bg-white p-8">
          <h1 className="text-3xl font-bold text-slate-950">
            Portfolio content is ready for Sanity.
          </h1>
          <p className="mt-3 max-w-2xl text-slate-700">
            Configure the Sanity environment variables and add the initial site
            settings document in Studio to publish the live portfolio content.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="home" className="px-5 py-16 md:px-8 md:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
            {settings.role}
          </p>
          <h1 className="mt-4 text-5xl font-bold leading-tight text-slate-950 md:text-6xl">
            {settings.name}
          </h1>
          {settings.heroDescription ? (
            <p className="mt-6 max-w-3xl text-xl leading-9 text-slate-700">
              {settings.heroDescription}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/#projects"
              className="inline-flex items-center justify-center rounded-md bg-teal-800 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-900"
            >
              {primaryCtaText}
            </Link>
            {resumeHref ? (
              <a
                href={resumeHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                {secondaryCtaText}
              </a>
            ) : null}
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            {settings.linkedinUrl ? (
              <SocialLink href={settings.linkedinUrl} label="LinkedIn" icon={<Linkedin size={18} />} />
            ) : null}
            {settings.githubUrl ? (
              <SocialLink href={settings.githubUrl} label="GitHub" icon={<Github size={18} />} />
            ) : null}
            {settings.email ? (
              <SocialLink href={`mailto:${settings.email}`} label="Email" icon={<Mail size={18} />} />
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {settings.profileImage?.url ? (
            <div className="relative mb-5 aspect-[4/3] overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              <Image
                src={settings.profileImage.url}
                alt={settings.profileImage.alt || `${settings.name} profile image`}
                fill
                className="object-cover"
                priority
              />
            </div>
          ) : null}
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
            Snapshot
          </h2>
          <div className="mt-4 grid gap-3">
            {settings.heroMetrics?.map((metric) => (
              <div
                key={metric}
                className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-900"
              >
                {metric}
              </div>
            ))}
          </div>
          {settings.availabilityText ? (
            <p className="mt-5 rounded-md bg-teal-50 p-3 text-sm font-medium text-teal-950">
              {settings.availabilityText}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SocialLink({
  href,
  label,
  icon
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel={href.startsWith("mailto:") ? undefined : "noreferrer"}
      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
    >
      {icon}
      {label}
    </a>
  );
}
