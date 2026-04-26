import { motion, useAnimationFrame, useMotionValue, useTransform } from "framer-motion";
import { memo, useEffect, useRef } from "react";

interface Props {
  /** URL the WebView can render (use toAssetUrl(absPath) on app-data files). */
  coverUrl: string | null;
  playing: boolean;
  /** Target angular velocity in degrees per second when playing.
   *  33 1/3 RPM = 200 deg/s. */
  targetDps?: number;
}

/**
 * Top-down vinyl record. The record's angular velocity is integrated each
 * frame and asymptotes toward the target speed when playing or toward 0
 * when paused, producing real spin-up/spin-down momentum (no CSS keyframes).
 *
 * The tonearm is a separate <motion.div> rotated via a spring  it lifts
 * off (rotates "out") when paused and drops back when playing.
 */
function VinylPlayerImpl({ coverUrl, playing, targetDps = 200 }: Props) {
  const angle = useMotionValue(0);          // current rotation, degrees
  const speed = useRef(playing ? targetDps : 0); // current angular velocity

  // First-order low-pass: speed -> target. Tau differs for spin-up vs spin-down
  // so the deceleration feels weighty (record + platter inertia).
  const TAU_UP = 0.6;     // seconds to reach ~63% of target on play
  const TAU_DOWN = 2.4;   // longer tail on pause  feels like real momentum

  useAnimationFrame((_, deltaMs) => {
    const dt = Math.min(deltaMs, 64) / 1000;
    const target = playing ? targetDps : 0;
    const tau = playing ? TAU_UP : TAU_DOWN;
    const k = 1 - Math.exp(-dt / tau);
    speed.current += (target - speed.current) * k;
    angle.set(angle.get() + speed.current * dt);
  });

  const rotate = useTransform(angle, (a) => `${a}deg`);

  // Tonearm: target -22deg when playing (resting on record), +18deg when paused.
  const armRest = -22;
  const armLift = 18;
  const arm = useMotionValue(playing ? armRest : armLift);
  useEffect(() => { arm.set(playing ? armRest : armLift); }, [playing, arm]);

  return (
    <div className="relative aspect-square w-full max-w-[520px] mx-auto">
      {/* Platter shadow */}
      <div className="absolute inset-0 rounded-full bg-black/20 blur-2xl scale-95" />

      {/* Record */}
      <motion.div
        className="absolute inset-0 rounded-full bg-[#0b0b0d] shadow-2xl
                   ring-1 ring-white/5 overflow-hidden"
        style={{ rotate }}
      >
        {/* Concentric grooves */}
        <Grooves />

        {/* Center label = album cover */}
        <div className="absolute inset-[34%] rounded-full overflow-hidden ring-1 ring-white/10">
          {coverUrl ? (
            <img
              src={coverUrl}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-elevated" />
          )}
          {/* Spindle hole */}
          <div className="absolute left-1/2 top-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2
                          rounded-full bg-bg ring-1 ring-black/40" />
        </div>
      </motion.div>

      {/* Tonearm: pivots from the top-right corner of the platter. */}
      <motion.div
        className="absolute -top-3 -right-3 origin-top-right"
        style={{ rotate: arm }}
        transition={{ type: "spring", stiffness: 90, damping: 16, mass: 1.2 }}
        animate={{ rotate: playing ? armRest : armLift }}
      >
        <Tonearm />
      </motion.div>
    </div>
  );
}

export default memo(VinylPlayerImpl);

function Grooves() {
  // Nine concentric rings  cheap "grooves" without large SVG.
  return (
    <div className="absolute inset-0">
      {Array.from({ length: 9 }).map((_, i) => {
        const inset = 4 + i * 4;
        return (
          <div
            key={i}
            className="absolute rounded-full ring-1 ring-white/[0.04]"
            style={{ inset: `${inset}%` }}
          />
        );
      })}
    </div>
  );
}

function Tonearm() {
  return (
    <svg width="180" height="180" viewBox="0 0 180 180" className="drop-shadow-lg">
      {/* Pivot */}
      <circle cx="160" cy="20" r="14" fill="#1a1a1f" stroke="#33333a" />
      <circle cx="160" cy="20" r="5"  fill="#3a3a44" />
      {/* Arm */}
      <rect x="48" y="14" width="116" height="10" rx="4" fill="#202028" />
      {/* Headshell */}
      <rect x="32" y="6"  width="28" height="26" rx="4" fill="#2a2a32" />
      {/* Stylus tip */}
      <circle cx="34" cy="32" r="3" fill="#9aa0aa" />
    </svg>
  );
}
