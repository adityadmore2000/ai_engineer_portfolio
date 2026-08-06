import Link from "next/link";
import { ExternalLink, Github } from "lucide-react";
import type { ProjectSummary } from "@/sanity/types";
import { AnalyticsEvents } from "@/lib/analytics";
import { LightboxImage } from "./LightboxImage";
import { Markdown } from "./Markdown";
import { TrackLink } from "./Analytics";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {project.coverImage?.url ? (
        <div className="relative aspect-[16/9] border-b border-slate-200 bg-slate-100">
          <LightboxImage
            src={project.coverImage.url}
            alt={project.coverImage.alt || `${project.title} cover image`}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/9] items-center justify-center border-b border-slate-200 bg-slate-100 px-6 text-center text-sm font-medium text-slate-500">
          Add a cover image in Sanity Studio
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl font-bold text-slate-950">{project.title}</h3>
        {project.shortSummary ? (
          <Markdown className="mt-3 text-slate-700">
            {project.shortSummary}
          </Markdown>
        ) : null}

        {project.keyMetrics?.[0] ? (
          <p className="mt-4 rounded-md bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-950">
            {project.keyMetrics[0]}
          </p>
        ) : null}

        {project.technologies?.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {project.technologies.slice(0, 6).map((technology) => (
              <span
                key={technology}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
              >
                {technology}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
          {project.slug ? (
            <Link
              href={`/projects/${project.slug}`}
              className="rounded-md bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900"
            >
              View Details
            </Link>
          ) : null}
          {project.githubUrl ? (
            <TrackLink
              href={project.githubUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${project.title} GitHub repository`}
              event={AnalyticsEvents.ExternalClick}
              metadata={{ destination: "github" }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Github aria-hidden="true" size={17} />
            </TrackLink>
          ) : null}
          {project.demoUrl ? (
            <TrackLink
              href={project.demoUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`${project.title} demo`}
              event={AnalyticsEvents.ExternalClick}
              metadata={{ destination: "demo" }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <ExternalLink aria-hidden="true" size={17} />
            </TrackLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}
