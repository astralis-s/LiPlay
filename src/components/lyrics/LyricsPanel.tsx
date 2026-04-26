import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";

import { api } from "@/lib/tauri";
import { parseLrc, activeLineIndex } from "@/lib/lrc";
import { usePlayer } from "@/stores/playerStore";
import { errMsg } from "@/lib/errors";
import ManualSync from "./ManualSync";

interface Props { trackId: string; }

export default function LyricsPanel({ trackId }: Props) {
  const [body, setBody] = useState<string>("");
  const [synced, setSynced] = useState(false);
  const [source, setSource] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const position = usePlayer((s) => s.position_ms);
  const lines = parseLrc(body);
  const active = activeLineIndex(lines, position);

  useEffect(() => {
    let cancelled = false;
    setHint(null); setBody(""); setSynced(false); setSource("");
    api.loadLrc(trackId).then((p) => {
      if (cancelled) return;
      if (p) { setBody(p.body); setSynced(p.synced); setSource(p.source); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [trackId]);

  async function fetchOnline() {
    setBusy(true); setHint(null);
    try {
      const p = await api.fetchLyrics(trackId);
      setBody(p.body); setSynced(p.synced); setSource(p.source);
      if (!p.body) setHint("LRCLIB has no match for this track");
    } catch (e) { setHint(`Fetch failed: ${errMsg(e)}`); }
    finally { setBusy(false); }
  }

  async function importLrc() {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: "Lyrics", extensions: ["lrc", "txt"] }],
    });
    if (typeof path !== "string") return;
    try {
      const text = await readTextFile(path);
      await api.saveLrc(trackId, text, /\[\d+:\d+/.test(text), "import");
      setBody(text);
      setSynced(/\[\d+:\d+/.test(text));
      setSource("import");
      setHint("Loaded .lrc");
    } catch (e) { setHint(`Failed: ${errMsg(e)}`); }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col gap-3 mt-4 pt-4 border-t border-outline"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs uppercase tracking-wider text-muted">Lyrics</h4>
        {source && <span className="text-[10px] uppercase text-muted/70">{source}</span>}
      </div>

      {body ? (
        <div className="text-sm leading-relaxed text-text max-h-[260px] overflow-y-auto space-y-1">
          {lines.map((l, i) => (
            <div
              key={i}
              className={[
                "transition-colors",
                synced && i === active ? "text-text" : "text-muted",
              ].join(" ")}
            >
              {l.text}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No lyrics yet.</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={fetchOnline}
          disabled={busy}
          className="py-2 rounded-lg text-xs bg-elevated hover:bg-elevated/80 disabled:opacity-50"
        >
          {busy ? "..." : "LRCLIB"}
        </button>
        <button
          onClick={importLrc}
          className="py-2 rounded-lg text-xs bg-elevated hover:bg-elevated/80"
        >
          Open .lrc
        </button>
        <button
          onClick={() => setManualOpen(true)}
          className="py-2 rounded-lg text-xs bg-elevated hover:bg-elevated/80"
        >
          Manual
        </button>
      </div>
      {hint && <div className="text-[11px] text-muted">{hint}</div>}

      <ManualSync open={manualOpen} onClose={() => setManualOpen(false)} trackId={trackId} />
    </motion.div>
  );
}
