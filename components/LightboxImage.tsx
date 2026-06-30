"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { ImageLightbox } from "./ImageLightbox";

type LightboxImageProps = Omit<ImageProps, "src" | "alt" | "onClick"> & {
  src: string;
  alt: string;
};

/**
 * A next/image that opens a fullscreen zoom/pan lightbox when clicked.
 * Pass the same layout props (fill, sizes, className, priority…) you would
 * give to next/image; the original `src`/`alt` are forwarded to the viewer.
 *
 * The click handler lives on a wrapping <button> that covers the image area
 * rather than on the next/image element itself — next/image does not reliably
 * forward DOM event handlers onto the underlying <img>, so attaching onClick
 * directly to it silently did nothing.
 */
export function LightboxImage({ src, alt, ...imageProps }: LightboxImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Open ${alt || "image"} in fullscreen viewer`}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          padding: 0,
          margin: 0,
          border: "none",
          background: "transparent",
          cursor: "zoom-in",
          appearance: "none"
        }}
      >
        <Image {...imageProps} src={src} alt={alt} />
      </button>
      <ImageLightbox
        src={src}
        alt={alt}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
