import type { Transition } from "framer-motion";

/** Snappy but soft  feels like macOS sheet open. */
export const springFast: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 0.9 };

/** Layout/sidebar reveal  more travel, gentler arrival. */
export const springGlide: Transition = { type: "spring", stiffness: 220, damping: 28, mass: 1.0 };

/** Karaoke open/close  long, cinematic. */
export const springStage: Transition = { type: "spring", stiffness: 140, damping: 22, mass: 1.1 };

/** Used for the splash logo  smooth ease, no bounce. */
export const easeKinetic: Transition = { duration: 0.9, ease: [0.16, 1, 0.3, 1] };
