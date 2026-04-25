import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import SplashScreen from "@/components/splash/SplashScreen";
import LeftSidebar from "@/components/layout/LeftSidebar";
import RightSidebar from "@/components/layout/RightSidebar";
import CenterView from "@/components/layout/CenterView";
import BottomBar from "@/components/layout/BottomBar";
import KaraokeMode from "@/components/karaoke/KaraokeMode";

import { usePlayer } from "@/stores/playerStore";
import { useTheme } from "@/stores/themeStore";
import { springStage } from "@/animations/springs";
import { toAssetUrl } from "@/lib/tauri";

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const bind = usePlayer((s) => s.bind);
  const setTheme = useTheme((s) => s.setTheme);
  const refreshAdaptive = useTheme((s) => s.refreshAdaptive);
  const themeId = useTheme((s) => s.id);
  const current = usePlayer((s) => s.current);

  // Apply default theme + subscribe to engine position events.
  useEffect(() => {
    setTheme("clean-light");
    let unlisten: (() => void) | undefined;
    bind().then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);

  // Adaptive theme reacts to track changes.
  useEffect(() => {
    if (themeId !== "adaptive" || !current?.cover_path) return;
    const url = toAssetUrl(`Covers/${current.cover_path}`);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    refreshAdaptive(url, prefersDark);
  }, [themeId, current?.cover_path]);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg text-text">
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      {/* Spring-based drop-down of the main UI once the splash starts fading. */}
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
    </div>
  );
}
