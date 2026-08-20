import type { ProjectSummary } from "@/sanity/types";
import { ProjectCard } from "./ProjectCard";

export function Projects({ projects }: { projects: ProjectSummary[] }) {
  if (!projects.length) {
    return null;
  }

  return (
    <section
      id="projects"
      className="bg-white"
      style={{
        paddingLeft: "var(--section-padding-x)",
        paddingRight: "var(--section-padding-x)",
        paddingTop: "var(--section-padding-y)",
        paddingBottom: "var(--section-padding-y)",
      }}
    >
      <h2
        className="heading-display text-[clamp(2.5rem,6vw,5rem)] text-[#121315]"
      >
        WORKS
      </h2>
      <p className="mt-3 max-w-xl text-lg text-[#9ca3af]">
        A selection of projects showcasing my work in applied AI engineering.
      </p>

      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {projects.map((project) => (
          <ProjectCard key={project._id} project={project} />
        ))}
      </div>

    </section>
  );
}
