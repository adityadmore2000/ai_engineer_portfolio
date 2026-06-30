"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, MousePointer2 } from "lucide-react";

type ImageLightboxProps = {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
};

type Tool = "pan" | "cursor";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ImageLightbox({ src, alt, isOpen, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>("cursor");

  const dragStart = useRef({ x: 0, y: 0 });
  const translateStart = useRef({ x: 0, y: 0 });

  // Reset zoom/pan/tool whenever the lightbox is (re)opened, including on a new image.
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setTranslate({ x: 0, y: 0 });
      setIsDragging(false);
      setActiveTool("cursor");
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
      // Panning is gated on the explicit Pan tool, not on zoom level.
      if (activeTool !== "pan") {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      dragStart.current = { x: event.clientX, y: event.clientY };
      translateStart.current = { ...translate };
    },
    [activeTool, translate]
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

  const isPanMode = activeTool === "pan";
  // In pan mode the cursor reflects grab/grabbing; otherwise the default
  // zoom-affordance cursor (scroll-wheel zoom still works here).
  const cursor = isPanMode
    ? isDragging
      ? "grabbing"
      : "grab"
    : "zoom-in";

  const toolButtonStyle = (active: boolean): React.CSSProperties => ({
    width: "2.75rem",
    height: "2.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#ffffff",
    background: active ? "var(--accent)" : "rgba(255,255,255,0.12)",
    border: active ? "1px solid var(--accent-strong)" : "1px solid transparent",
    borderRadius: "9999px",
    cursor: "pointer",
    zIndex: 1
  });

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
      <div
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          zIndex: 1
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Mutually exclusive tool toggle: exactly one of Pan / Cursor is active. */}
        <div role="group" aria-label="Image tool" style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            aria-label="Pan tool"
            aria-pressed={isPanMode}
            onClick={() => setActiveTool("pan")}
            style={toolButtonStyle(isPanMode)}
          >
            <Hand aria-hidden="true" size={20} />
          </button>
          <button
            type="button"
            aria-label="Cursor tool"
            aria-pressed={!isPanMode}
            onClick={() => setActiveTool("cursor")}
            style={toolButtonStyle(!isPanMode)}
          >
            <MousePointer2 aria-hidden="true" size={20} />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close image preview"
          style={{
            width: "2.75rem",
            height: "2.75rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.75rem",
            lineHeight: 1,
            color: "#ffffff",
            background: "rgba(255,255,255,0.12)",
            border: "1px solid transparent",
            borderRadius: "9999px",
            cursor: "pointer"
          }}
        >
          ×
        </button>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        onClick={(event) => {
          // Always keep a click on the image from bubbling to the backdrop
          // (which would close the lightbox). In pan mode, additionally
          // suppress any click-driven image interactions — the user chose
          // to drag/pan, not to click.
          event.stopPropagation();
          if (isPanMode) {
            return;
          }
          // Cursor mode: existing click-based interactions run as before.
        }}
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
