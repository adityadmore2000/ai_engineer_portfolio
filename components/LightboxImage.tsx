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
 */
export function LightboxImage({ src, alt, ...imageProps }: LightboxImageProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Image
        {...imageProps}
        src={src}
        alt={alt}
        onClick={() => setIsOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          }
        }}
        style={{ ...imageProps.style, cursor: "zoom-in" }}
      />
      <ImageLightbox
        src={src}
        alt={alt}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
