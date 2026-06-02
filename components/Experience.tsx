import type { ExperienceItem } from "@/sanity/types";
import { SectionShell } from "./SectionShell";

export function Experience({ experiences }: { experiences: ExperienceItem[] }) {
  if (!experiences.length) {
    return null;
  }

  return (
    <SectionShell
      id="experience"
      eyebrow="Experience"
      title="Work and applied project experience"
    >
      <div className="space-y-5">
        {experiences.map((experience) => (
          <article
            key={experience._id}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-950">
                  {experience.role}
                </h3>
                <p className="mt-1 font-semibold text-slate-700">
                  {experience.company}
                  {experience.location ? ` · ${experience.location}` : ""}
                </p>
              </div>
              <p className="text-sm font-medium text-slate-500">
                {formatDateRange(experience)}
              </p>
            </div>
            {experience.shortDescription ? (
              <p className="mt-4 leading-7 text-slate-700">
                {experience.shortDescription}
              </p>
            ) : null}
            {experience.bulletPoints?.length ? (
              <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-700">
                {experience.bulletPoints.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : null}
            {experience.skills?.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {experience.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

function formatDateRange(experience: ExperienceItem) {
  const start = formatMonth(experience.startDate);
  const end = experience.currentRole ? "Present" : formatMonth(experience.endDate);

  if (!start && !end) {
    return "";
  }

  return `${start || "Started"} - ${end || "Present"}`;
}

function formatMonth(date?: string) {
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric"
  }).format(new Date(date));
}
