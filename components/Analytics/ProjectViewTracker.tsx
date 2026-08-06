"use client";

import { useEffect, useRef } from "react";
import { trackProjectView } from "@/lib/analytics";

type ProjectViewTrackerProps = {
  slug: string;
};

export function ProjectViewTracker({ slug }: ProjectViewTrackerProps) {
  const lastSlug = useRef<string | null>(null);

  useEffect(() => {
    if (lastSlug.current === slug) return;
    lastSlug.current = slug;
    trackProjectView(slug);
  }, [slug]);

  return null;
}