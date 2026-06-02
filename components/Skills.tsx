import type { SkillCategory } from "@/sanity/types";
import { SectionShell } from "./SectionShell";

export function Skills({ categories }: { categories: SkillCategory[] }) {
  if (!categories.length) {
    return null;
  }

  return (
    <SectionShell id="skills" eyebrow="Skills" title="Core technical skills">
      <div className="grid gap-5 md:grid-cols-2">
        {categories.map((category) => (
          <section
            key={category._id}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <h3 className="text-lg font-bold text-slate-950">{category.title}</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {category.skills?.map((skill) => (
                <span
                  key={skill}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-medium text-slate-700"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
    </SectionShell>
  );
}
