import { AnimatePresence, motion } from "framer-motion";
import { useUi } from "@/stores/uiStore";
import { usePlayer } from "@/stores/playerStore";
import { springGlide } from "@/animations/springs";
import TagEditor from "@/components/library/TagEditor";
import { toAssetUrl } from "@/lib/tauri";

export default function RightSidebar() {
  const open = useUi((s) => s.rightOpen);
  const current = usePlayer((s) => s.current);
  const cover = current?.cover_path ? toAssetUrl(`Covers/${current.cover_path}`) : null;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="right"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 340, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={springGlide}
          className="h-full overflow-hidden border-l border-outline bg-surface"
        >
          <div className="w-[340px] h-full overflow-y-auto p-5 flex flex-col gap-4">
            <h3 className="text-xs uppercase tracking-wider text-muted">Now selected</h3>

            {current ? (
              <>
                <div className="aspect-square w-full rounded-2xl bg-elevated overflow-hidden">
                  {cover && <img src={cover} className="w-full h-full object-cover" alt="" />}
                </div>
                <div>
                  <div className="text-lg font-medium text-text leading-tight">{current.title}</div>
                  <div className="text-sm text-muted">{current.artist}</div>
                  <div className="text-sm text-muted">{current.album}</div>
                </div>
                <TagEditor track={current} />
              </>
            ) : (
              <div className="text-sm text-muted">Select a track to see details.</div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
