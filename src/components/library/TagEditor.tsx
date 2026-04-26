import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

import { api } from "@/lib/tauri";
import { errMsg } from "@/lib/errors";
import { useLibrary } from "@/stores/libraryStore";
import type { Track } from "@/lib/types";

interface Props { track: Track; }

export default function TagEditor({ track }: Props) {
  const refresh = useLibrary((s) => s.refreshTracks);
  const [title, setTitle]   = useState(track.title);
  const [artist, setArtist] = useState(track.artist);
  const [album, setAlbum]   = useState(track.album);
  const [saving, setSaving] = useState(false);
  const [hint, setHint]     = useState<string | null>(null);

  useEffect(() => {
    setTitle(track.title); setArtist(track.artist); setAlbum(track.album); setHint(null);
  }, [track.id]);

  async function save() {
    setSaving(true); setHint(null);
    try {
      await api.writeTags(track.id, { title, artist, album });
      await refresh();
      setHint("Saved to file");
    } catch (e) { setHint(`Failed: ${errMsg(e)}`); }
    finally { setSaving(false); }
  }

  async function pickCover() {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg"] }],
    });
    if (typeof path !== "string") return;
    const bytes = await readFile(path);
    const mime = path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    setSaving(true);
    try {
      await api.setCover(track.id, bytes, mime);
      await refresh();
      setHint("Cover written into file");
    } catch (e) { setHint(`Failed: ${errMsg(e)}`); }
    finally { setSaving(false); }
  }

  return (
    <motion.div
      key={track.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-3 mt-4 pt-4 border-t border-outline"
    >
      <h4 className="text-xs uppercase tracking-wider text-muted">Edit tags</h4>
      <Field label="Title"  value={title}  onChange={setTitle}  />
      <Field label="Artist" value={artist} onChange={setArtist} />
      <Field label="Album"  value={album}  onChange={setAlbum}  />

      <div className="flex gap-2 mt-1">
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 py-2 rounded-xl bg-text text-bg text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Writing..." : "Save to file"}
        </button>
        <button
          onClick={pickCover}
          disabled={saving}
          className="px-3 py-2 rounded-xl border border-outline text-text text-sm hover:bg-elevated"
        >
          Cover...
        </button>
      </div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </motion.div>
  );
}

function Field({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg bg-elevated text-text text-sm
                   outline-none border border-transparent focus:border-outline"
      />
    </label>
  );
}
