import type { WorkingProcessStep } from "@/sanity/types";

export function WorkingProcess({ steps }: { steps: WorkingProcessStep[] }) {
  if (!steps.length) {
    return null;
  }

  return (
    <section
      id="working-process"
      className="w-full bg-[var(--color-dark,#121315)]"
      style={{
        paddingTop: "var(--section-padding-y, 100px)",
        paddingBottom: "var(--section-padding-y, 100px)",
        paddingLeft: "var(--section-padding-x, 80px)",
        paddingRight: "var(--section-padding-x, 80px)"
      }}
    >
      <div className="mb-14">
        <h2
          className="heading-display text-white"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.02em" }}
        >
          WORKING PROCESS
        </h2>
        <p
          className="mt-3 text-[var(--color-gray-400,#9ca3af)] max-w-xl"
          style={{ fontFamily: "var(--font-inter, sans-serif)" }}
        >
          How I approach every applied AI project — from problem framing to deployment.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {steps.map((step) => (
          <div key={step._id} className="flex flex-col gap-3">
            <span
              className="heading-display text-[var(--color-coral,#e36444)]"
              style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)" }}
              aria-hidden="true"
            >
              {String(step.stepNumber).padStart(2, "0")}
            </span>
            <h3
              className="text-xl font-bold text-white"
              style={{ fontFamily: "var(--font-outfit, sans-serif)" }}
            >
              {step.title}
            </h3>
            {step.description ? (
              <p
                className="text-[var(--color-gray-400,#9ca3af)] leading-relaxed"
                style={{ fontFamily: "var(--font-inter, sans-serif)" }}
              >
                {step.description}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
