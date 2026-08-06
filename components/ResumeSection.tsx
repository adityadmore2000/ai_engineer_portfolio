import { FileText } from "lucide-react";
import type { SiteSettings } from "@/sanity/types";
import { getResumeHref } from "@/sanity/utils";
import { AnalyticsEvents } from "@/lib/analytics";
import { SectionShell } from "./SectionShell";
import { TrackLink } from "./Analytics";

export function ResumeSection({ settings }: { settings?: SiteSettings | null }) {
  const resumeHref = getResumeHref(settings);

  if (!settings || !resumeHref) {
    return null;
  }

  return (
    <SectionShell
      id="resume"
      eyebrow="Resume"
      title="Detailed resume"
      description="For role fit, project depth, and timeline details, review the latest resume configured from the CMS."
      className="bg-white"
    >
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 md:flex md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white text-teal-800">
            <FileText aria-hidden="true" size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-950">Resume PDF</h3>
            <p className="mt-1 text-slate-700">
              Download or open the current recruiter-ready resume.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-0">
          <TrackLink
            href={resumeHref}
            event={AnalyticsEvents.FileDownload}
            metadata={{ file: "resume", format: "pdf" }}
            className="inline-flex items-center justify-center rounded-md bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900"
          >
            Download Resume
          </TrackLink>
          <TrackLink
            href={resumeHref}
            target="_blank"
            rel="noreferrer"
            event={AnalyticsEvents.FileDownload}
            metadata={{ file: "resume", format: "pdf" }}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            View Resume
          </TrackLink>
        </div>
      </div>
    </SectionShell>
  );
}
