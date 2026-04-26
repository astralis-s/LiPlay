import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

export interface MenuItem {
  label: string;
  onSelect?: () => void;
  destructive?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
  disabled?: boolean;
}

interface Props {
  open: boolean;
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ open, x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Clamp inside viewport so the menu never opens off-screen.
  const clampedX = Math.min(x, window.innerWidth - 240);
  const clampedY = Math.min(y, window.innerHeight - items.length * 36 - 16);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.96, y: -4 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{    opacity: 0, scale: 0.96, y: -4 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          style={{ left: clampedX, top: clampedY }}
          className="fixed z-[80] min-w-[220px] py-1 bg-surface border border-outline
                     rounded-xl shadow-2xl text-text"
        >
          {items.map((it, i) => it.separator ? (
            <div key={i} className="my-1 mx-2 h-px bg-outline" />
          ) : it.submenu ? (
            <SubmenuItem key={i} item={it} onClose={onClose} />
          ) : (
            <button
              key={i}
              disabled={it.disabled}
              onClick={() => { it.onSelect?.(); onClose(); }}
              className={[
                "block w-full text-left px-3 py-2 text-sm rounded-lg mx-1",
                it.destructive ? "text-red-500 hover:bg-red-500/10" : "hover:bg-elevated",
                it.disabled ? "opacity-40 cursor-not-allowed" : "",
              ].join(" ")}
            >
              {it.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SubmenuItem({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  return (
    <div className="relative group">
      <div className="flex items-center justify-between w-full px-3 py-2 text-sm rounded-lg mx-1 hover:bg-elevated cursor-default">
        <span>{item.label}</span>
        <span className="text-muted text-xs"></span>
      </div>
      <div className="hidden group-hover:block absolute top-0 left-full -ml-1 min-w-[200px] py-1 bg-surface border border-outline rounded-xl shadow-2xl">
        {item.submenu?.map((sub, j) => (
          <button
            key={j}
            disabled={sub.disabled}
            onClick={() => { sub.onSelect?.(); onClose(); }}
            className={[
              "block w-full text-left px-3 py-2 text-sm rounded-lg mx-1",
              sub.destructive ? "text-red-500 hover:bg-red-500/10" : "hover:bg-elevated",
              sub.disabled ? "opacity-40 cursor-not-allowed" : "",
            ].join(" ")}
          >
            {sub.label}
          </button>
        ))}
      </div>
    </div>
  );
}
