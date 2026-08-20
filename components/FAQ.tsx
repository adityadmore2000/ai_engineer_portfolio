"use client";

import type { FaqItem } from "@/sanity/types";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function FAQ({ items }: { items: FaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (!items.length) {
    return null;
  }

  return (
    <section
      id="faq"
      className="w-full bg-[var(--color-gray-100,#f3f4f6)]"
      style={{
        paddingTop: "var(--section-padding-y, 100px)",
        paddingBottom: "var(--section-padding-y, 100px)",
        paddingLeft: "var(--section-padding-x, 80px)",
        paddingRight: "var(--section-padding-x, 80px)"
      }}
    >
      <div className="mb-14">
        <h2
          className="heading-display text-[var(--color-dark,#121315)]"
          style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", letterSpacing: "-0.02em" }}
        >
          FAQ's
        </h2>

      </div>

      <div className="flex flex-col gap-4 max-w-3xl">
        {items.map((item) => {
          const isOpen = openId === item._id;
          return (
            <div
              key={item._id}
              className="overflow-hidden rounded-[16px] bg-white"
            >
              <button
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpenId(isOpen ? null : item._id)}
                aria-expanded={isOpen}
              >
                <span
                  className="font-semibold text-[var(--color-dark,#121315)]"
                  style={{ fontFamily: "var(--font-inter, sans-serif)" }}
                >
                  {item.question}
                </span>
                <ChevronDown
                  className="shrink-0 text-[var(--color-gray-400,#9ca3af)] transition-transform duration-200"
                  size={20}
                  style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                  aria-hidden="true"
                />
              </button>

              {isOpen && item.answer ? (
                <div
                  className="px-6 pb-5 text-[var(--color-gray-500,#6b7280)] leading-relaxed"
                  style={{ fontFamily: "var(--font-inter, sans-serif)" }}
                >
                  {item.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
