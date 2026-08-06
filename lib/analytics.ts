export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

export const isAnalyticsEnabled = Boolean(GA_MEASUREMENT_ID);

export type AnalyticsEvent =
  | "resume_download"
  | "project_view"
  | "contact_click"
  | "github_click"
  | "linkedin_click"
  | "demo_click";

export type ClickAnalyticsEvent = Exclude<AnalyticsEvent, "project_view">;

type GtagWindow = {
  gtag?: (...args: unknown[]) => void;
};

function send(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as GtagWindow;
  if (typeof w.gtag !== "function") return;
  w.gtag(...args);
}

function trackEvent(event: AnalyticsEvent, params?: Record<string, unknown>): void {
  if (!isAnalyticsEnabled) return;
  send("event", event, params ?? {});
}

export function pageview(): void {
  if (!isAnalyticsEnabled || typeof window === "undefined") return;
  send("event", "page_view", {
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: document.title
  });
}

export function trackResumeDownload(): void {
  trackEvent("resume_download");
}

export function trackProjectView(slug: string): void {
  if (!slug) return;
  trackEvent("project_view", { project_slug: slug });
}

export function trackContactClick(): void {
  trackEvent("contact_click");
}

export function trackGithubClick(): void {
  trackEvent("github_click");
}

export function trackLinkedInClick(): void {
  trackEvent("linkedin_click");
}

export function trackDemoClick(): void {
  trackEvent("demo_click");
}