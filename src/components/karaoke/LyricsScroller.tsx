import { motion } from "framer-motion";
import { useMemo } from "react";
import type { ParsedLrcLine } from "@/lib/types";
import { activeLineIndex } from "@/lib/lrc";

interface Props {
  lines: ParsedLrcLine[];
  positionMs: number;
  /** Pixel height of one line slot. */
  lineHeight?: number;
}

/**
 * Kinetically scrolling lyrics with a vertical transparency mask.
 *
 * Performance notes:
 *   * Only lines within `WINDOW` of the active index are rendered. With
 *     long songs (200+ lines) the previous full-list render created
 *     hundreds of Framer Motion springs every frame, which is what made
 *     karaoke mode lag.
 *   * Each visible line is positioned absolutely at `top: 50% + delta`,
 *     so we don't depend on a giant translated container.
 *   * Filter (blur) and color values are written via `style` instead of
 *     animated through a spring  the active-line scroll itself is the
 *     only spring, and it's on the parent container.
 */

const WINDOW = 14;

export default function LyricsScroller({ lines, positionMs, lineHeight = 72 }: Props) {
  const active = useMemo(() => activeLineIndex(lines, positionMs), [lines, positionMs]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 16%, black 84%, transparent 100%)",
      }}
    >
      <div className="absolute left-0 right-0" style={{ top: "50%" }}>
        {lines.map((line, i) => {
          const distance = i - active;
          if (Math.abs(distance) > WINDOW) return null;

          const isActive = distance === 0;
          const absDist  = Math.abs(distance);
          const blur     = isActive ? 0 : Math.min(7, absDist * 1.0);
          const opacity  = isActive ? 1 : Math.max(0.18, Math.pow(0.74, absDist));
          const scale    = isActive ? 1.0 : 0.94;

          return (
            <motion.div
              key={i}
              className="absolute inset-x-0 px-16 will-change-transform text-center"
              initial={false}
              animate={{
                top: distance * lineHeight,
                opacity,
                scale,
              }}
              transition={{ type: "spring", stiffness: 160, damping: 26, mass: 0.9 }}
              style={{
                filter: blur > 0 ? `blur(${blur}px)` : undefined,
                color: isActive ? "rgb(255 255 255)" : "rgb(255 255 255 / 0.85)",
                fontWeight: isActive ? 800 : 700,
                fontSize:    isActive ? "3.25rem" : "2.5rem",
                lineHeight:  `${lineHeight}px`,
                letterSpacing: "-0.01em",
              }}
            >
              {line.text || " "}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
