import { AnimatePresence, motion } from "framer-motion";
import { IconHome, IconLibrary } from "@/components/icons/Icons";
import { useUi } from "@/stores/uiStore";
import { springGlide } from "@/animations/springs";
import PlaylistList from "@/components/playlist/PlaylistList";

export default function LeftSidebar() {
  const open = useUi((s) => s.leftOpen);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const openEq = useUi((s) => s.openEq);
  const openTheme = useUi((s) => s.openTheme);

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
          <div className="w-[240px] h-full p-4 flex flex-col gap-1">
            <NavItem
              icon={<IconHome />}
              label="Home"
              active={view.kind === "home"}
              onClick={() => setView({ kind: "home" })}
            />
            <NavItem
              icon={<IconLibrary />}
              label="Library"
              active={view.kind === "library"}
              onClick={() => setView({ kind: "library" })}
            />

            <div className="mt-6 mb-2 text-[11px] uppercase tracking-wider text-muted px-3">
              Playlists
            </div>
            <PlaylistList />

            <div className="mt-auto pt-4 border-t border-outline flex flex-col gap-1">
              <button
                onClick={openEq}
                className="px-3 py-2 rounded-xl text-left text-sm text-muted hover:text-text hover:bg-elevated"
              >
                Equalizer
              </button>
              <button
                onClick={openTheme}
                className="px-3 py-2 rounded-xl text-left text-sm text-muted hover:text-text hover:bg-elevated"
              >
                Theme
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function NavItem({
  icon, label, active, onClick,
}: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-3 px-3 py-2 rounded-xl text-left",
        active ? "bg-elevated text-text" : "text-text hover:bg-elevated/60",
      ].join(" ")}
    >
      <span className={active ? "text-accent" : "text-muted"}>{icon}</span>
      <span className="text-sm">{label}</span>
    </button>
  );
}
