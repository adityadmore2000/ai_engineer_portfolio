"use client";

import Avatar from "boring-avatars";

const PALETTE = ["#1e293b", "#e36444", "#2a9d8f", "#e9c46a", "#475569"];

export function ProjectCoverFallback({ name }: { name: string }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Avatar
        name={name}
        variant="marble"
        square
        colors={PALETTE}
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-6">
        <span className="text-center text-2xl font-semibold leading-snug text-white drop-shadow-md">
          {name}
        </span>
      </div>
    </div>
  );
}
