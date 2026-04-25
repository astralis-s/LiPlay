import { motion } from "framer-motion";
import { springGlide } from "@/animations/springs";

export default function CenterView() {
  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGlide}
      className="flex-1 h-full overflow-y-auto px-10 py-8"
    >
      <h1 className="text-3xl font-medium tracking-tight text-text">Home</h1>
      <p className="mt-2 text-muted">Recommendations and monthly recap appear here.</p>
      {/* Grids: TrackGrid, AlbumGrid, MonthlyRecap */}
    </motion.main>
  );
}
