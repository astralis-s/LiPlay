import { AnimatePresence, motion } from "framer-motion";
import { IconHome, IconLibrary } from "@/components/icons/Icons";
import { useUi } from "@/stores/uiStore";
import { springGlide } from "@/animations/springs";

export default function LeftSidebar() {
  const open = useUi((s) => s.leftOpen);
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="left"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 240, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={springGlide}
          className="h-full overflow-hidden border-r border-outline bg-surface"
        >
          <div className="w-[240px] p-4 flex flex-col gap-1">
            <NavItem icon={<IconHome />} label="Home" />
            <NavItem icon={<IconLibrary />} label="Library" />
            <div className="mt-6 mb-2 text-[11px] uppercase tracking-wider text-muted">
              Playlists
            </div>
            {/* Playlists are populated by hooks/usePlaylists.ts */}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function NavItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex items-center gap-3 px-3 py-2 rounded-xl text-left
                       hover:bg-elevated text-text">
      <span className="text-muted">{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
