export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";

export const isAnalyticsEnabled = Boolean(GA_MEASUREMENT_ID);

/**
 * Recommended event taxonomy. Consumers may pass any string `eventName` to
 * `trackEvent` / `TrackLink` — adding a new tracked interaction requires no
 * change to this file. Import these constants only to prevent typos and to
 * keep call sites discoverable; they are not an exhaustive allow-list.
 *
 * See `docs/analytics-tracking-guide.md` for the full parameter contract.
 */
export const AnalyticsEvents = {
  ExternalClick: "external_click",
  FileDownload: "file_download",
  ProjectView: "project_view",
  ContactAction: "contact_action"
} as const;

type GtagWindow = {
  gtag?: (...args: unknown[]) => void;
};

/**
 * Single low-level wrapper around `window.gtag`. It is:
 * - SSR-safe (returns early when there is no `window`),
 * - tolerant of blocked / unloaded gtag (returns early when `gtag` is missing,
 *   e.g. ad blockers, privacy extensions, GA script not yet downloaded),
 * - exception-isolated (any failure here is swallowed so analytics can never
 *   break navigation or other UI behavior).
 */
function send(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as GtagWindow;
  if (typeof w.gtag !== "function") return;
  try {
    w.gtag(...args);
  } catch {
    // Analytics must never break the user's click / navigation.
  }
}

/**
 * Generic, extensible event dispatcher. UA components describe a user action
 * (the `eventName`) and optional `metadata`; this layer decides how it
 * reaches Google Analytics 4.
 *
 * Delivery is silent when GA is disabled (`NEXT_PUBLIC_GA_MEASUREMENT_ID`
 * unset), blocked, or yet to load — never throws, never logs.
 *
 * `transport_type: "beacon"` is configured globally in `GoogleAnalytics.tsx`
 * so every event uses `navigator.sendBeacon` for reliability during
 * navigation, without polluting per-event parameters in GA4 DebugView.
 */
export function trackEvent(
  eventName: string,
  metadata?: Record<string, string>
): void {
  if (!isAnalyticsEnabled) return;
  send("event", eventName, metadata ?? {});
}

/**
 * Fires a `page_view` event for SPA (client-side) navigations. The initial
 * page view on first load is sent automatically by GA4 via
 * `gtag('config', ..., { send_page_view: true })` in
 * `components/Analytics/GoogleAnalytics.tsx`; this helper only handles
 * subsequent `usePathname()` changes.
 */
export function pageview(): void {
  if (!isAnalyticsEnabled || typeof window === "undefined") return;
  send("event", "page_view", {
    page_path: window.location.pathname + window.location.search,
    page_location: window.location.href,
    page_title: document.title
  });
}