"use client";

import Link from "next/link";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { useState } from "react";
import type { SiteSettings } from "@/sanity/types";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

const navItems = [
  { label: "Works", href: "/#projects" },
  { label: "About", href: "/#about" },
  { label: "Experience", href: "/#experience" },
  { label: "Contact", href: "/#contact" },
];

export function Header({ settings }: { settings?: SiteSettings | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const name = settings?.name || "Aditya More";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-[#121315]">
      <nav className="flex items-center justify-between px-[var(--section-padding-x)] py-4">
        <Link
          href="/#home"
          className="text-base font-bold text-white"
          style={{ fontFamily: "var(--font-inter), sans-serif" }}
        >
          {name}
        </Link>

        <div className="hidden items-center gap-8 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-white/70 transition-colors hover:text-white"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/#contact"
            onClick={() => trackEvent(AnalyticsEvents.ContactAction, { method: "header_cta" })}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/30 px-5 py-2 text-sm font-medium text-white transition-colors hover:border-[#e36444] hover:text-[#e36444]"
          >
            Let&apos;s Talk <ArrowUpRight size={14} />
          </Link>
        </div>

        <button
          type="button"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={isOpen}
          onClick={() => setIsOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-white lg:hidden"
        >
          {isOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
        </button>
      </nav>

      {isOpen ? (
        <div className="border-t border-white/10 bg-[#121315] px-[var(--section-padding-x)] py-4 lg:hidden">
          <div className="flex flex-col gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/#contact"
              onClick={() => {
                trackEvent(AnalyticsEvents.ContactAction, { method: "header_cta" });
                setIsOpen(false);
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/30 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-[#e36444] hover:text-[#e36444]"
            >
              Let&apos;s Talk <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
