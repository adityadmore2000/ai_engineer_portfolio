"use client";

import type { AnchorHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import {
  trackContactClick,
  trackDemoClick,
  trackGithubClick,
  trackLinkedInClick,
  trackResumeDownload,
  type ClickAnalyticsEvent
} from "@/lib/analytics";

const clickDispatch: Record<ClickAnalyticsEvent, () => void> = {
  resume_download: trackResumeDownload,
  contact_click: trackContactClick,
  github_click: trackGithubClick,
  linkedin_click: trackLinkedInClick,
  demo_click: trackDemoClick
};

type TrackLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  event?: ClickAnalyticsEvent;
  children: ReactNode;
};

export function TrackLink({ event, children, ...rest }: TrackLinkProps) {
  const handleClick: MouseEventHandler<HTMLAnchorElement> = () => {
    if (event) {
      clickDispatch[event]();
    }
  };

  return (
    <a {...rest} onClick={handleClick}>
      {children}
    </a>
  );
}