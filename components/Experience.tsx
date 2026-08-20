import type { ExperienceItem } from "@/sanity/types";
import { Markdown } from "./Markdown";

export function Experience({ experiences }: { experiences: ExperienceItem[] }) {
  if (!experiences.length) {
    return null;
  }

  return (
    <section
      id="experience"
      className="w-full bg-white"
      style={{
        paddingTop: "var(--section-padding-y, 100px)",
        paddingBottom: "var(--section-padding-y, 100px)",
        paddingLeft: "var(--section-padding-x, 80px)",
        paddingRight: "var(--section-padding-x, 80px)"
      }}
    >
      <div className="mb-12">
        <h2
          className="heading-display text-[var(--color-dark,#121315)]"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.02em" }}
        >
          EXPERIENCE
        </h2>
      </div>

      <div>
        {experiences.map((experience) => (
          <article
            key={experience._id}
            className="border-t border-slate-200 py-8 last:border-b"
          >
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h3
                  className="text-xl font-bold text-[var(--color-dark,#121315)]"
                  style={{ fontFamily: "var(--font-outfit, sans-serif)" }}
                >
                  {experience.role}
                </h3>
                <p
                  className="mt-1 text-base text-slate-600"
                  style={{ fontFamily: "var(--font-inter, sans-serif)", fontWeight: 500 }}
                >
                  {experience.company}
                  {experience.location ? ` · ${experience.location}` : ""}
                </p>
              </div>
              <p
                className="label-mono text-[var(--color-gray-400,#9ca3af)] shrink-0 pt-1"
              >
                {formatDateRange(experience)}
              </p>
            </div>

            {experience.shortDescription ? (
              <Markdown className="mt-4 text-slate-700">
                {experience.shortDescription}
              </Markdown>
            ) : null}

            {experience.bulletPoints?.length ? (
              <ul
                className="mt-4 list-disc space-y-1.5 pl-5 text-slate-700"
                style={{ fontFamily: "var(--font-inter, sans-serif)" }}
              >
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
                    className="pill-badge border-[var(--color-gray-400,#9ca3af)] text-[var(--color-dark,#121315)]"
                    style={{ fontFamily: "var(--font-inter, sans-serif)" }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDateRange(experience: ExperienceItem) {
  const start = formatMonth(experience.startDate);
  const end = experience.currentRole ? "Present" : formatMonth(experience.endDate);

  if (!start && !end) {
    return "";
  }

  return `${start || "Started"} – ${end || "Present"}`;
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
