import type { SiteSettings } from "./types";

export function getResumeHref(settings?: SiteSettings | null) {
  return settings?.resumeFile?.url || settings?.resumeUrl || "";
}
