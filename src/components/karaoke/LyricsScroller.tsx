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
 * Kinetically-scrolling lyrics with a vertical transparency mask.
 *
 *   - The active line is stark white and sharp.
 *   - Lines further from the active index get progressively blurred
 *     (CSS blur filter) and faded.
 *   - The whole column translates with a soft spring so the active line
 *     stays vertically centered  no jank, no jump cuts.
 *   - A CSS mask-image creates a hard fade-to-transparent at the top/bottom
 *     edges so the lyrics appear to "emerge" from nothing.
 */
export default function LyricsScroller({ lines, positionMs, lineHeight = 56 }: Props) {
  const active = useMemo(() => activeLineIndex(lines, positionMs), [lines, positionMs]);

  // Center the active line: column starts 50% down the container, then offsets up
  // by (active * lineHeight). Framer's spring smooths the y change.
  const y = -active * lineHeight;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        // Vertical fade mask: opaque in the middle band, transparent at edges.
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
        maskImage:
          "linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)",
      }}
    >
      <motion.ul
        className="absolute left-0 right-0 px-12 text-3xl font-medium text-white"
        style={{ top: "50%" }}
        animate={{ y }}
        transition={{ type: "spring", stiffness: 140, damping: 26, mass: 0.9 }}
      >
        {lines.map((line, i) => {
          const distance = Math.abs(i - active);
          const isActive = i === active;

          // Blur scales with distance: 0px on active, +1.4px per line, clamp at 8.
          const blur = Math.min(8, distance * 1.4);
          // Opacity decays exponentially.
          const opacity = isActive ? 1 : Math.max(0.18, Math.pow(0.72, distance));
          // Subtle scale falloff.
          const scale = isActive ? 1.0 : 0.96;

          return (
            <motion.li
              key={`${i}-${line.time}`}
              className="leading-[56px] h-[56px] -mt-[28px] will-change-transform"
              initial={false}
              animate={{
                filter: `blur(${blur}px)`,
                opacity,
                scale,
                color: isActive ? "rgb(255 255 255)" : "rgb(255 255 255 / 0.85)",
              }}
              transition={{ type: "spring", stiffness: 220, damping: 28 }}
              style={{ height: lineHeight, lineHeight: `${lineHeight}px` }}
            >
              {line.text || " "}
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}
