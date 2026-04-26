import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

/** Subscribes to the spectrum analyser stream emitted by the audio engine.
 *  Returns the latest 32-bin magnitude vector (values in [0, 1]). */
export function useFft() {
  const [bins, setBins] = useState<number[]>(() => Array(32).fill(0));
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<number[]>("liplay://spectrum", (e) => setBins(e.payload))
      .then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);
  return bins;
}
