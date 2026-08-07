"use client";

import { useEffect, useRef } from "react";
import { AnalyticsEvents, trackEvent } from "@/lib/analytics";

type ProjectViewTrackerProps = {
  slug: string;
};

export function ProjectViewTracker({ slug }: ProjectViewTrackerProps) {
  const lastSlug = useRef<string | null>(null);

  useEffect(() => {
    if (lastSlug.current === slug) return;
    lastSlug.current = slug;
    trackEvent(AnalyticsEvents.ProjectView, { project_slug: slug });
  }, [slug]);

  return null;
}