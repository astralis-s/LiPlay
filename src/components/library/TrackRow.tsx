import { useState } from "react";
import { motion } from "framer-motion";
import { toAssetUrl } from "@/lib/tauri";
import { usePlayer } from "@/stores/playerStore";
import { useLibrary } from "@/stores/libraryStore";
import { useUi } from "@/stores/uiStore";
import ContextMenu, { type MenuItem } from "@/components/menu/ContextMenu";
import type { Track } from "@/lib/types";

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

interface Props {
  track: Track;
  index: number;
  active: boolean;
  onPlay: (t: Track) => void;
  /** Optional: when shown inside a playlist, allow "Remove from playlist". */
  inPlaylistId?: string;
  onChanged?: () => void;
}

export default function TrackRow({ track, index, active, onPlay, inPlaylistId, onChanged }: Props) {
  const cover = track.cover_path ? toAssetUrl(track.cover_path, "cover") : null;
  const setCurrent = usePlayer((s) => s.setCurrent);
  const playlists = useLibrary((s) => s.playlists);
  const addToPlaylist = useLibrary((s) => s.addToPlaylist);
  const removeFromPlaylist = useLibrary((s) => s.removeFromPlaylist);
  const removeTrack = useLibrary((s) => s.removeTrack);
  const toggleRight = useUi((s) => s.toggleRight);
  const rightOpen = useUi((s) => s.rightOpen);

  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const items: MenuItem[] = [
    { label: "Play", onSelect: () => onPlay(track) },
    { label: "Show details", onSelect: () => { setCurrent(track); if (!rightOpen) toggleRight(); } },
    { separator: true, label: "" },
    {
      label: "Add to playlist",
      submenu: playlists.length === 0
        ? [{ label: "No playlists  create one in the sidebar", disabled: true }]
        : playlists.map((p) => ({
            label: p.name,
            onSelect: async () => { await addToPlaylist(p.id, track.id); onChanged?.(); },
          })),
    },
    ...(inPlaylistId ? [{
      label: "Remove from this playlist",
      onSelect: async () => {
        await removeFromPlaylist(inPlaylistId, track.id);
        onChanged?.();
      },
    } as MenuItem] : []),
    { separator: true, label: "" },
    {
      label: "Delete from library",
      destructive: true,
      onSelect: async () => { await removeTrack(track.id); onChanged?.(); },
    },
  ];

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: index * 0.012 }}
        onDoubleClick={() => onPlay(track)}
        onClick={() => setCurrent(track)}
        onContextMenu={(e) => {
          e.preventDefault();
          setCurrent(track);
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        className={[
          "grid grid-cols-[40px_56px_1fr_1fr_80px] items-center gap-4 px-3 py-2 rounded-xl cursor-pointer",
          active ? "bg-elevated" : "hover:bg-elevated/60",
        ].join(" ")}
      >
        <div className="text-xs text-muted tabular-nums">{(index + 1).toString().padStart(2, "0")}</div>
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-elevated">
          {cover && <img src={cover} alt="" className="w-full h-full object-cover" draggable={false} />}
        </div>
        <div className="min-w-0">
          <div className={["text-sm truncate", active ? "text-accent" : "text-text"].join(" ")}>
            {track.title}
          </div>
          <div className="text-xs text-muted truncate">{track.artist}</div>
        </div>
        <div className="text-sm text-muted truncate">{track.album}</div>
        <div className="text-xs text-muted text-right tabular-nums">{fmt(track.duration_ms)}</div>
      </motion.div>

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
