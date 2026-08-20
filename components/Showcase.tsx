import type { SiteSettings, ExperienceItem } from "@/sanity/types";
import { getResumeHref } from "@/sanity/utils";
import { extractVideoId } from "@/lib/utils/youtube";
import { AnalyticsEvents } from "@/lib/analytics";
import { TrackLink } from "./Analytics";

type ShowcaseProps = {
  settings?: SiteSettings | null;
  experiences?: ExperienceItem[];
};

function VideoEmbed({ url }: { url: string }) {
  const videoId = extractVideoId(url);
  if (!videoId) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-card,16px)]"
      style={{ aspectRatio: "16/9" }}
    >
      <iframe
        src={`https://www.youtube.com/embed/${videoId}`}
        title="Introduction video"
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}

export function Showcase({ settings, experiences: _experiences = [] }: ShowcaseProps) {
  const resumeHref = getResumeHref(settings);
  const hasVideo = Boolean(settings?.introductionVideoUrl);

  return (
    <section
      id="showcase"
      className="w-full bg-white"
      style={{
        padding: "var(--section-padding-y, 100px) var(--section-padding-x, 80px)",
      }}
    >
      <div className={`grid gap-10 lg:gap-12 items-center ${hasVideo ? "lg:grid-cols-2" : ""}`}>
        {/* Left — Text + CV download */}
        <div className="flex flex-col gap-6">
          <div>
            <p
              className="label-mono mb-3 text-[var(--color-gray-400,#9ca3af)]"
              style={{ fontFamily: "var(--font-geist-mono, monospace)" }}
            >
              ABOUT ME
            </p>
            <h2
              className="heading-display text-[var(--color-dark,#121315)]"
              style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
            >
              WHO I AM
            </h2>
            {settings?.shortBio ? (
              <p
                className="mt-4 max-w-2xl text-[var(--color-gray-500,#6b7280)]"
                style={{ fontFamily: "var(--font-inter, sans-serif)", fontSize: "1rem", lineHeight: "1.75" }}
              >
                {settings.shortBio}
              </p>
            ) : null}
          </div>

          {resumeHref ? (
            <TrackLink
              href={resumeHref}
              event={AnalyticsEvents.FileDownload}
              metadata={{ file: "resume", format: "pdf" }}
              className="inline-flex items-center justify-center self-start rounded-full border-2 border-[var(--color-coral,#e36444)] bg-transparent px-6 py-3 text-sm font-semibold text-[var(--color-coral,#e36444)] transition hover:bg-[var(--color-coral,#e36444)] hover:text-white"
              style={{ fontFamily: "var(--font-inter, sans-serif)" }}
            >
              Download CV
            </TrackLink>
          ) : null}
        </div>

        {/* Right — Introduction video */}
        {settings?.introductionVideoUrl ? (
          <div className="mx-auto w-full max-w-lg">
            <VideoEmbed url={settings.introductionVideoUrl} />
          </div>
        ) : null}
      </div>
    </section>
  );
}