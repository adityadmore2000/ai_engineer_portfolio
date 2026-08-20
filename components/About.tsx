import type { SiteSettings } from "@/sanity/types";

export function About({ settings }: { settings?: SiteSettings | null }) {
  if (!settings?.focusAreas?.length) {
    return null;
  }

  return (
    <section
      id="about"
      className="w-full bg-white"
      style={{
        paddingTop: "0",
        paddingBottom: "var(--section-padding-y, 100px)",
        paddingLeft: "var(--section-padding-x, 80px)",
        paddingRight: "var(--section-padding-x, 80px)"
      }}
    >
      <div className="mb-8">
        <h3
          className="heading-display text-[var(--color-dark,#121315)]"
          style={{ fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)" }}
        >
          FOCUS AREAS
        </h3>
      </div>

      <div className="flex flex-wrap gap-3">
        {settings.focusAreas.map((area) => (
          <span
            key={area}
            className="pill-badge border-[var(--color-gray-400,#9ca3af)] text-[var(--color-dark,#121315)]"
            style={{ fontFamily: "var(--font-inter, sans-serif)" }}
          >
            {area}
          </span>
        ))}
      </div>
    </section>
  );
}
