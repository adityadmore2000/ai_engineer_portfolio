import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Github } from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { PortableContent } from "@/components/PortableContent";
import { SectionShell } from "@/components/SectionShell";
import { getAllProjects, getProjectBySlug, getSiteSettings } from "@/sanity/queries";
import type { SanityImage } from "@/sanity/types";

export const revalidate = 60;

type ProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  const projects = await getAllProjects();

  return projects
    .filter((project) => project.slug)
    .map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params
}: ProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProjectBySlug(slug);

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
  const [settings, project] = await Promise.all([
    getSiteSettings(),
    getProjectBySlug(slug)
  ]);

  if (!project) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <Header settings={settings} />
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
                {project.title}
              </h1>
              {project.shortSummary ? (
                <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
                  {project.shortSummary}
                </p>
              ) : null}

              {project.coverImage?.url ? (
                <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <Image
                    src={project.coverImage.url}
                    alt={project.coverImage.alt || `${project.title} cover image`}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : null}

              <DetailBlock title="Problem" text={project.problemStatement} />
              <DetailBlock title="Approach" text={project.approach} />
              <DetailBlock title="Results" text={project.results} />

              {project.architectureImage?.url ? (
                <ImageBlock
                  title="Architecture"
                  src={project.architectureImage.url}
                  alt={
                    project.architectureImage.alt ||
                    `${project.title} architecture diagram`
                  }
                />
              ) : null}

              {project.screenshots?.length ? (
                <section className="mt-12">
                  <h2 className="text-2xl font-bold text-slate-950">Screenshots</h2>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    {project.screenshots
                      .filter(hasImageUrl)
                      .map((screenshot) => (
                      <div
                        key={screenshot.url}
                        className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                      >
                        <Image
                          src={screenshot.url}
                          alt={screenshot.alt || `${project.title} screenshot`}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <DetailBlock title="Limitations" text={project.limitations} />
              <DetailBlock
                title="Future Improvements"
                text={project.futureImprovements}
              />

              {project.detailedContent ? (
                <section className="mt-12">
                  <h2 className="text-2xl font-bold text-slate-950">Details</h2>
                  <PortableContent value={project.detailedContent} />
                </section>
              ) : null}
            </article>

            <aside className="h-fit rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              {project.keyMetrics?.length ? (
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Outcomes
                  </h2>
                  <ul className="mt-3 space-y-2">
                    {project.keyMetrics.map((metric) => (
                      <li
                        key={metric}
                        className="rounded-md bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-950"
                      >
                        {metric}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {project.technologies?.length ? (
                <div className="mt-6">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                    Technologies
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {project.technologies.map((technology) => (
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

              <div className="mt-6 flex flex-col gap-3">
                {project.githubUrl ? (
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    <Github aria-hidden="true" size={17} />
                    GitHub
                  </a>
                ) : null}
                {project.demoUrl ? (
                  <a
                    href={project.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
                  >
                    <ExternalLink aria-hidden="true" size={17} />
                    Live Demo
                  </a>
                ) : null}
              </div>
            </aside>
          </div>
        </SectionShell>
      </main>
      <Footer settings={settings} />
    </div>
  );
}

function hasImageUrl(image: SanityImage): image is SanityImage & { url: string } {
  return Boolean(image.url);
}

function DetailBlock({ title, text }: { title: string; text?: string }) {
  if (!text) {
    return null;
  }

  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
      <p className="mt-4 max-w-3xl leading-8 text-slate-700">{text}</p>
    </section>
  );
}

function ImageBlock({
  title,
  src,
  alt
}: {
  title: string;
  src: string;
  alt: string;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold text-slate-950">{title}</h2>
      <div className="relative mt-5 aspect-[16/9] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <Image src={src} alt={alt} fill className="object-cover" />
      </div>
    </section>
  );
}
