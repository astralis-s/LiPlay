import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import App from "@/App";
import Osd from "@/components/osd/Osd";
import "@/index.css";

// Suppress the WebKit default context menu globally; per-element handlers
// re-open our custom popover when appropriate.
window.addEventListener("contextmenu", (e) => e.preventDefault());

// One JS bundle, two roots. The OSD window is created with label "osd"
// from the Rust side; everything else is the main UI.
let isOsd = false;
try { isOsd = getCurrentWebviewWindow().label === "osd"; } catch {}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isOsd ? <Osd /> : <App />}
  </React.StrictMode>,
);
