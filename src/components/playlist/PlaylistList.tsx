import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "@/stores/libraryStore";
import { useUi } from "@/stores/uiStore";
import ContextMenu, { type MenuItem } from "@/components/menu/ContextMenu";
import type { Playlist } from "@/lib/types";

export default function PlaylistList() {
  const { playlists, refreshPlaylists, createPlaylist, deletePlaylist } = useLibrary();
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [menu, setMenu] = useState<{ x: number; y: number; pl: Playlist } | null>(null);

  useEffect(() => { refreshPlaylists(); }, []);

  const items: MenuItem[] = menu ? [
    { label: "Open", onSelect: () => setView({ kind: "playlist", id: menu.pl.id }) },
    { separator: true, label: "" },
    {
      label: "Delete playlist",
      destructive: true,
      onSelect: async () => {
        await deletePlaylist(menu.pl.id);
        if (view.kind === "playlist" && view.id === menu.pl.id) setView({ kind: "home" });
      },
    },
  ] : [];

  return (
    <>
      <div className="flex flex-col gap-1">
        {playlists.map((p) => {
          const active = view.kind === "playlist" && view.id === p.id;
          return (
            <motion.button
              key={p.id}
              layout
              onClick={() => setView({ kind: "playlist", id: p.id })}
              onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, pl: p }); }}
              className={[
                "px-3 py-2 rounded-xl text-left text-sm truncate",
                active ? "bg-elevated text-text" : "text-text hover:bg-elevated/60",
              ].join(" ")}
            >
              {p.name}
            </motion.button>
          );
        })}

        {creating ? (
          <input
            autoFocus
            value={name}
            placeholder="Playlist name"
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { setCreating(false); setName(""); }}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && name.trim()) {
                await createPlaylist(name.trim());
                setName(""); setCreating(false);
              }
              if (e.key === "Escape") { setCreating(false); setName(""); }
            }}
            className="px-3 py-2 rounded-xl bg-elevated text-text text-sm outline-none"
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="px-3 py-2 rounded-xl text-left text-sm text-muted hover:text-text hover:bg-elevated"
          >
            + New playlist
          </button>
        )}
      </div>

      <ContextMenu
        open={menu !== null}
        x={menu?.x ?? 0}
        y={menu?.y ?? 0}
        items={items}
        onClose={() => setMenu(null)}
      />
    </>
  );
}
