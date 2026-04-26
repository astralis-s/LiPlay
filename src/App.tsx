import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import SplashScreen from "@/components/splash/SplashScreen";
import LeftSidebar from "@/components/layout/LeftSidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import CenterView from "@/components/layout/CenterView";
import BottomBar from "@/components/layout/BottomBar";
import KaraokeMode from "@/components/karaoke/KaraokeMode";
import Equalizer from "@/components/equalizer/Equalizer";
import ThemePicker from "@/components/theme/ThemePicker";

import { usePlayer } from "@/stores/playerStore";
import { useTheme } from "@/stores/themeStore";
import { useUi } from "@/stores/uiStore";
import { springStage } from "@/animations/springs";
import { ensurePaths, toAssetUrl } from "@/lib/tauri";

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const bind = usePlayer((s) => s.bind);
  const setTheme = useTheme((s) => s.setTheme);
  const refreshAdaptive = useTheme((s) => s.refreshAdaptive);
  const themeId = useTheme((s) => s.id);
  const current = usePlayer((s) => s.current);
  const next = usePlayer((s) => s.next);

  const { eqOpen, closeEq, themeOpen, closeTheme } = useUi();

  // Auto-advance: when sink finishes (position close to duration AND playing
  // becomes false from the engine), call next() once.
  const advanceLatch = useRef(false);

  useEffect(() => {
    setTheme("clean-light");
    ensurePaths().catch(() => {});
    let unlisten: (() => void) | undefined;
    bind().then((fn) => { unlisten = fn; });

    const id = window.setInterval(() => {
      const s = usePlayer.getState();
      const ended =
        s.duration_ms > 0 &&
        s.position_ms >= s.duration_ms - 250 &&
        !s.playing;
      if (ended && !advanceLatch.current) {
        advanceLatch.current = true;
        next().finally(() => {
          setTimeout(() => { advanceLatch.current = false; }, 800);
        });
      }
    }, 200);

    return () => { unlisten?.(); window.clearInterval(id); };
  }, []);

  useEffect(() => {
    if (themeId !== "adaptive-light" && themeId !== "adaptive-dark") return;
    if (!current?.cover_path) return;
    refreshAdaptive(toAssetUrl(current.cover_path, "cover"));
  }, [themeId, current?.cover_path]);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text">
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0,    opacity: 1 }}
        transition={{ ...springStage, delay: 0.6 }}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="flex-1 flex min-h-0">
          <LeftSidebar />
          <CenterView />
          <RightSidebar />
        </div>
        <BottomBar />
      </motion.div>

      <KaraokeMode />
      <Equalizer open={eqOpen} onClose={closeEq} />
      <ThemePicker open={themeOpen} onClose={closeTheme} />
    </div>
  );
}
