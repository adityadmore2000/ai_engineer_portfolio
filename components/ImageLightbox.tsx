"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ImageLightboxProps = {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ImageLightbox({ src, alt, isOpen, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  // Reset zoom/pan whenever the lightbox is (re)opened, including on a new image.
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen, src]);

  // Close on Escape and lock background scroll while open.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLImageElement>) => {
    setScale((current) => {
      const next = clamp(current - event.deltaY * 0.001, MIN_SCALE, MAX_SCALE);
      if (next === MIN_SCALE) {
        setTranslate({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (scale <= MIN_SCALE) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      dragStart.current = { x: event.clientX, y: event.clientY };
      translateStart.current = { ...translate };
    },
    [scale, translate]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (!isDragging) {
        return;
      }
      const dx = event.clientX - dragStart.current.x;
      const dy = event.clientY - dragStart.current.y;
      setTranslate({
        x: translateStart.current.x + dx,
        y: translateStart.current.y + dy
      });
    },
    [isDragging]
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLImageElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsDragging(false);
    },
    []
  );

  if (!isOpen) {
    return null;
  }

  const pannable = scale > MIN_SCALE;
  const cursor = isDragging ? "grabbing" : pannable ? "grab" : "zoom-in";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        aria-label="Close image preview"
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          width: "2.75rem",
          height: "2.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.75rem",
          lineHeight: 1,
          color: "#ffffff",
          background: "rgba(255,255,255,0.12)",
          border: "none",
          borderRadius: "9999px",
          cursor: "pointer",
          zIndex: 1
        }}
      >
        ×
      </button>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={(event) => event.stopPropagation()}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          maxWidth: "92vw",
          maxHeight: "92vh",
          objectFit: "contain",
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.05s ease-out",
          cursor,
          touchAction: "none",
          userSelect: "none"
        }}
      />
    </div>
  );
}
