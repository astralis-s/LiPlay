import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "@/lib/tauri";
import { springStage } from "@/animations/springs";

interface Props { open: boolean; onClose: () => void; }

/** Modal with the QR code + raw URLs other devices can use. */
export default function ListenTogether({ open, onClose }: Props) {
  const [svg, setSvg] = useState<string>("");
  const [info, setInfo] = useState<{ url: string; ws_url: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    api.listenTogetherQr().then(setSvg).catch(() => setSvg(""));
    api.localServerInfo().then(setInfo).catch(() => setInfo(null));
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm flex items-center justify-center"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0,  opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={springStage}
            onClick={(e) => e.stopPropagation()}
            className="w-[420px] bg-surface text-text rounded-3xl border border-outline p-5 shadow-2xl"
          >
            <h3 className="text-lg font-medium mb-1">Listen Together</h3>
            <p className="text-xs text-muted mb-4">
              Scan with another device on this Wi-Fi. It will mirror playback in real time.
            </p>

            <div className="aspect-square w-full bg-white rounded-2xl overflow-hidden flex items-center justify-center">
              {svg ? (
                <div className="w-[88%] h-[88%]" dangerouslySetInnerHTML={{ __html: svg }} />
              ) : (
                <div className="text-muted text-sm">Generating...</div>
              )}
            </div>

            {info && (
              <div className="mt-4 text-[11px] text-muted font-mono space-y-1 break-all">
                <div>HTTP : {info.url}</div>
                <div>WS   : {info.ws_url}</div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-outline flex justify-end">
              <button onClick={onClose} className="text-sm text-muted hover:text-text">Close</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
