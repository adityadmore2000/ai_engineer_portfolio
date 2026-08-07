"use client";

import type {
  AnchorHTMLAttributes,
  MouseEventHandler,
  ReactNode
} from "react";
import { trackEvent } from "@/lib/analytics";

export type TrackLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /**
   * Symbolic user action name, e.g. `external_click`, `file_download`.
   * Any string is accepted — adding a new tracked interaction requires no
   * analytics-utility change. See `AnalyticsEvents` in `lib/analytics.ts`
   * for the recommended taxonomy.
   */
  event?: string;
  /**
   * Action metadata forwarded to GA4 as event parameters, e.g.
   * `{ destination: "github" }`. Optional, free-form.
   */
  metadata?: Record<string, string>;
  children: ReactNode;
};

/**
 * A drop-in `<a>` wrapper that emits an analytics event on click.
 *
 * The component only **describes** the user action (`event` + `metadata`);
 * the analytics layer (`lib/analytics.ts`) decides how it is delivered.
 *
 * Guarantees:
 * - Consumer-supplied `onClick` always runs (after analytics).
 * - Analytics failures (GA blocked, gtag undefined, etc.) never break the
 *   click or downstream navigation.
 * - Stays a client component; parent server components do not need to opt
 *   into client-side rendering to use it.
 */
export function TrackLink({
  event,
  metadata,
  onClick,
  children,
  ...rest
}: TrackLinkProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = (mouseEvent) => {
    if (event) {
      try {
        trackEvent(event, metadata);
      } catch {
        // Swallow: analytics must never block user navigation.
      }
    }
    onClick?.(mouseEvent);
  };

  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}