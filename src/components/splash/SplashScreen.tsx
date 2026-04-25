import { motion } from "framer-motion";
import { IconLogo } from "@/components/icons/Icons";
import { easeKinetic } from "@/animations/springs";

interface Props { onDone: () => void; }

export default function SplashScreen({ onDone }: Props) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ ...easeKinetic, delay: 0.9, duration: 0.45 }}
      onAnimationComplete={onDone}
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg pointer-events-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: -6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={easeKinetic}
        className="text-text"
      >
        <IconLogo width={88} height={88} />
      </motion.div>
    </motion.div>
  );
}
