import type { SiteSettings } from "@/sanity/types";
import { Markdown } from "./Markdown";
import { SectionShell } from "./SectionShell";

export function About({ settings }: { settings?: SiteSettings | null }) {
  if (!settings?.aboutSummary && !settings?.focusAreas?.length) {
    return null;
  }

  return (
    <SectionShell
      id="about"
      eyebrow="About"
      title="Applied AI for production-minded teams"
      className="bg-white"
    >
      {settings.aboutSummary ? (
        <Markdown className="mb-10 max-w-3xl text-lg text-slate-700">
          {settings.aboutSummary}
        </Markdown>
      ) : null}
      {settings.focusAreas?.length ? (
        <div>
          <h3 className="text-xl font-bold text-slate-950">What I Focus On</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {settings.focusAreas.map((area) => (
              <div
                key={area}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800"
              >
                {area}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </SectionShell>
  );
}
