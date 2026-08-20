import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProjectSummary } from "@/sanity/types";

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <article className="group overflow-hidden rounded-[16px] bg-[#f3f4f6] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden">
        {project.coverImage?.url ? (
          <Image
            src={project.coverImage.url}
            alt={project.coverImage.alt || `${project.title} cover image`}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-200 text-sm text-slate-500">
            Add a cover image in Sanity Studio
          </div>
        )}

        {project.technologies?.length ? (
          <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5">
            {project.technologies.slice(0, 4).map((tech) => (
              <span
                key={tech}
                className="rounded-full bg-black/60 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm"
              >
                {tech}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between p-5">
        <h3
          className="text-lg font-bold text-[#121315]"
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          {project.title}
        </h3>

        {project.slug ? (
          <Link
            href={`/projects/${project.slug}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#121315] text-white transition-colors hover:bg-[#e36444]"
            aria-label={`View ${project.title}`}
          >
            <ArrowUpRight size={16} />
          </Link>
        ) : null}
      </div>
    </article>
  );
}
