"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ShieldHalf } from "lucide-react";

const HeroGraph3D = dynamic(() => import("@/components/landing/HeroGraph3D"), {
  ssr: false,
  loading: () => <CanvasFallback />,
});

export default function Landing() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);

  // Prefetch the dashboard so the reveal cuts to a fully-loaded page.
  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  function enterConsole(e: React.MouseEvent) {
    e.preventDefault();
    if (entering) return;
    setEntering(true);
    // Navigate as the portal covers the screen — a seamless cut.
    window.setTimeout(() => router.push("/dashboard"), 1150);
  }

  return (
    <div className="relative h-screen w-full overflow-hidden">
      {/* 3D model — dives toward the viewer on enter */}
      <motion.div
        className="absolute inset-0"
        animate={entering ? { scale: 1.7, filter: "blur(6px)" } : { scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: [0.6, 0, 0.2, 1] }}
      >
        <HeroGraph3D />
      </motion.div>

      {/* Cinematic vignette */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(7,7,11,0.7)_100%)]" />

      {/* Top brand mark */}
      <motion.header
        className="absolute inset-x-0 top-0 z-10 flex justify-center pt-8"
        animate={{ opacity: entering ? 0 : 0.8 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-2">
            <ShieldHalf className="h-4 w-4 text-white" strokeWidth={2.2} />
          </span>
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-ink-soft">
            Scam Intelligence
          </span>
        </div>
      </motion.header>

      {/* Centered content — warps in on enter */}
      <motion.div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 text-center"
        animate={entering ? { scale: 1.35, opacity: 0, filter: "blur(8px)" } : { scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.6, 0, 0.2, 1] }}
      >
        <h1 className="animate-aegis-bounce text-[22vw] font-bold leading-none tracking-[0.1em] sm:text-8xl lg:text-[9.5rem]">
          <span className="grad-text drop-shadow-[0_0_50px_rgba(124,92,255,0.5)]">AE</span>
          <span className="text-brand-2 drop-shadow-[0_0_50px_rgba(34,211,238,0.5)]">GIS</span>
        </h1>

        <p className="mt-6 max-w-md text-xs font-medium uppercase tracking-[0.32em] text-muted sm:text-sm">
          Adaptive Entity Graph Intelligence for Scams
        </p>

        <button
          onClick={enterConsole}
          className="focus-ring pointer-events-auto group mt-10 inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-ink backdrop-blur-md transition-all hover:border-brand/50 hover:bg-brand/15"
        >
          Enter the console
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      </motion.div>

      {/* Footer credit */}
      <motion.footer
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center pb-7"
        animate={{ opacity: entering ? 0 : 1 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-[11px] uppercase tracking-[0.28em] text-muted/70">
          Powered by Cognee memory
        </span>
      </motion.footer>

      {/* ✦ Stunning warp-portal transition ✦ */}
      <AnimatePresence>
        {entering && (
          <motion.div className="fixed inset-0 z-50" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* expanding portal */}
            <motion.div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 58%, #22d3ee 0%, #7c5cff 38%, #0b0b14 74%)",
              }}
              initial={{ clipPath: "circle(0% at 50% 58%)" }}
              animate={{ clipPath: "circle(160% at 50% 58%)" }}
              transition={{ duration: 0.95, ease: [0.7, 0, 0.25, 1] }}
            />
            {/* expanding glow ring */}
            <motion.div
              className="absolute left-1/2 top-[58%] h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ boxShadow: "0 0 80px 30px rgba(124,92,255,0.8)" }}
              initial={{ scale: 0, opacity: 0.9 }}
              animate={{ scale: 30, opacity: 0 }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
            {/* white flash at the peak */}
            <motion.div
              className="absolute inset-0 bg-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0, 0.85, 0] }}
              transition={{ duration: 1.15, times: [0, 0.6, 0.78, 1] }}
            />
            {/* status readout */}
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center text-center"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: [0, 1, 1], y: 0 }}
              transition={{ delay: 0.45, duration: 0.6 }}
            >
              <div className="text-3xl font-bold tracking-[0.3em] text-white">AEGIS</div>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.4em] text-white/80">
                Initializing console
                <span className="inline-flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="inline-block"
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                    >
                      .
                    </motion.span>
                  ))}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CanvasFallback() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-40 w-40 animate-pulse rounded-full bg-[radial-gradient(closest-side,rgba(124,92,255,0.4),transparent)]" />
    </div>
  );
}
