import { AnimatePresence, motion } from "framer-motion";
import { useUi } from "@/stores/uiStore";
import { usePlayer } from "@/stores/playerStore";
import { springGlide } from "@/animations/springs";

export default function RightSidebar() {
  const open = useUi((s) => s.rightOpen);
  const current = usePlayer((s) => s.current);

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="right"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 320, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={springGlide}
          className="h-full overflow-hidden border-l border-outline bg-surface"
        >
          <div className="w-[320px] h-full p-5 flex flex-col gap-4">
            <h3 className="text-sm font-medium text-muted">Now playing</h3>
            <div className="text-lg font-medium text-text">{current?.title ?? ""}</div>
            <div className="text-sm text-muted">{current?.artist ?? ""}</div>
            <div className="text-sm text-muted">{current?.album ?? ""}</div>
            {/* Tag editor mounts here. */}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
