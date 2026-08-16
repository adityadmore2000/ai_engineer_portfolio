import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { LightboxImage } from "@/components/LightboxImage";
import { Markdown } from "@/components/Markdown";
import { SectionShell } from "@/components/SectionShell";
import { ProjectViewTracker } from "@/components/Analytics";
import { isSanityConfigured } from "@/sanity/env";
import {
  fallbackProjects,
  fallbackSiteSettings,
  getFallbackProjectBySlug
} from "@/sanity/fallbackContent";
import {
  getAllProjects,
  getProjectBySlug,
  getSiteSettings
} from "@/sanity/queries";

export const revalidate = 60;

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const projects = await getAllProjects();

  const sanityParams = projects
    .filter((project) => project.slug)
    .map((project) => ({ slug: project.slug }));
  const fallbackParams = isSanityConfigured
    ? []
    : fallbackProjects.map((project) => ({
        slug: project.slug || ""
      }));

  return [...sanityParams, ...fallbackParams].filter((param) => param.slug);
}

export async function generateMetadata({
  params
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const sanityProject = await getProjectBySlug(slug);
  const project = sanityProject || (!isSanityConfigured ? getFallbackProjectBySlug(slug) : null);

  if (!project) {
    return {
      title: "Project"
    };
  }

  return {
    title: project.title,
    description: project.shortSummary,
    openGraph: {
      title: project.title,
      description: project.shortSummary,
      images: project.coverImage?.url ? [project.coverImage.url] : undefined
    }
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { slug } = await params;
  const [settings, sanityProject] = await Promise.all([
    getSiteSettings(),
    getProjectBySlug(slug)
  ]);
  const pageSettings = settings || fallbackSiteSettings;
  const pageProject = sanityProject || (!isSanityConfigured ? getFallbackProjectBySlug(slug) : null);

  if (!pageProject) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={pageSettings} />
      <ProjectViewTracker slug={slug} />
      <main>
        <SectionShell className="pt-12">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800 hover:text-teal-950"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Back to projects
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <article>
              <p className="text-sm font-semibold uppercase tracking-wide text-teal-800">
                Project
              </p>
              <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight text-slate-950 md:text-5xl">
                {pageProject.title}
              </h1>

              {pageProject.shortSummary ? (
                <Markdown className="mt-5 max-w-3xl text-lg text-slate-700">
                  {pageProject.shortSummary}
                </Markdown>
              ) : null}

              {pageProject.coverImage?.url ? (
                <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <LightboxImage
                    src={pageProject.coverImage.url}
                    alt={pageProject.coverImage.alt || `${pageProject.title} cover image`}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : null}

              {pageProject.sections?.map((section) => (
                <section key={section._key} className="mt-12">
                  <h2 className="text-2xl font-bold text-slate-950">
                    {section.title}
                  </h2>
                  {section.description ? (
                    <Markdown className="mt-4 max-w-3xl text-slate-700">
                      {section.description}
                    </Markdown>
                  ) : null}
                </section>
              ))}
            </article>

            <aside className="h-fit rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              {pageProject.technologies?.length ? (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Technologies
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pageProject.technologies.map((technology) => (
                      <span
                        key={technology}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm text-slate-700"
                      >
                        {technology}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          </div>
        </SectionShell>
      </main>
      <Footer settings={pageSettings} />
    </div>
  );
}
