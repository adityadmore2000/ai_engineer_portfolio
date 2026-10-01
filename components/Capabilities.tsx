"use client";

import type { Capability } from "@/sanity/types";
import { useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Markdown } from "./Markdown";

export function Capabilities({ items }: { items: Capability[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!items.length) return null;
  return (
    <section id="capabilities" className="w-full bg-[var(--color-gray-100,#f3f4f6)]" style={{ padding: "var(--section-padding-y, 100px) var(--section-padding-x, 80px)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-gray-500,#6b7280)]">Independent AI Engineer</p>
          <h2 className="heading-display text-[var(--color-dark,#121315)]" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.02em" }}>What I Can Build</h2>
          <p className="mt-4 text-base leading-relaxed text-[var(--color-gray-500,#6b7280)]">AI systems shaped around real problems, from understanding the workflow through validation and iteration.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((item) => {
            const isOpen = openId === item._id;
            return <article key={item._id} className={`overflow-hidden rounded-2xl bg-white transition-shadow ${isOpen ? "shadow-md ring-1 ring-black/5 md:col-span-2" : "hover:shadow-sm"}`}>
              <button type="button" className="flex min-h-40 w-full items-end justify-between gap-5 p-6 text-left sm:p-8" onClick={() => setOpenId(isOpen ? null : item._id)} aria-expanded={isOpen} aria-controls={`capability-${item._id}`}>
                <span className="max-w-xl"><span className="block text-xl font-semibold tracking-tight text-[var(--color-dark,#121315)] sm:text-2xl">{item.title}</span><span className="mt-3 block text-sm leading-relaxed text-[var(--color-gray-500,#6b7280)]">{item.shortDescription}</span></span>
                <span className="mb-1 shrink-0 text-[var(--color-gray-500,#6b7280)]">{isOpen ? <ChevronDown className="rotate-180 transition-transform" size={22} /> : <ArrowUpRight size={22} />}</span>
              </button>
              {isOpen && <div id={`capability-${item._id}`} className="border-t border-slate-100 px-6 pb-7 pt-6 sm:px-8">
                {item.details && <Markdown className="max-w-3xl leading-relaxed text-slate-700">{item.details}</Markdown>}
                {!!item.useCases?.length && <div className="mt-5"><h3 className="text-sm font-semibold text-slate-900">Problems this can address</h3><ul className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">{item.useCases.map((useCase) => <li key={useCase} className="flex gap-2"><span className="text-indigo-500">↗</span>{useCase}</li>)}</ul></div>}
              </div>}
            </article>;
          })}
        </div>
      </div>
    </section>
  );
}
