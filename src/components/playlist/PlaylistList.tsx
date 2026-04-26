import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLibrary } from "@/stores/libraryStore";

export default function PlaylistList() {
  const { playlists, refreshPlaylists, createPlaylist } = useLibrary();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => { refreshPlaylists(); }, []);

  return (
    <div className="flex flex-col gap-1">
      {playlists.map((p) => (
        <motion.button
          key={p.id}
          layout
          className="px-3 py-2 rounded-xl text-left text-sm text-text hover:bg-elevated truncate"
        >
          {p.name}
        </motion.button>
      ))}

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
  );
}
