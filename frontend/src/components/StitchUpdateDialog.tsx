import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles, ArrowRight, Zap, Users, Layout, Cpu } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

// ─── Storage key ─────────────────────────────────────────────────────────────
const STORAGE_KEY = "stitch_update_v1_seen";

// ─── Feature bullets ─────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Zap,    label: "Generate UI flows instantly" },
  { icon: Users,  label: "Collaborate with AI in real time" },
  { icon: Layout, label: "Turn prompts into production-ready layouts" },
  { icon: Cpu,    label: "Adaptive design system suggestions" },
];

// ─── Helper: rounded rect path ───────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── Animated demo canvas ────────────────────────────────────────────────────
// The canvas always renders in dark mode (it's a "screen" / demo area),
// but its accent colours are derived from the app's --primary token so it
// still feels cohesive in both themes.
function DemoCanvas({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const tRef      = useRef(0);

  // Resolve the actual computed primary colour so the canvas matches the theme
  const accentRef = useRef({ r: 99, g: 60, b: 255 });
  useEffect(() => {
    // Read --primary from the document root at mount / theme change
   
    // --primary is a hex value like #191919 or #f3f3f3
    // We use it as a tint base; for the canvas we always want a purple-ish
    // accent regardless of theme, so we blend toward a fixed purple.
    // In dark mode the primary is near-white → we keep the purple accent.
    // In light mode the primary is near-black → same purple accent.
    // This keeps the "screen" feel consistent while the dialog chrome adapts.
    accentRef.current = isDark
      ? { r: 110, g: 70, b: 255 }
      : { r: 80,  g: 50, b: 200 };
  }, [isDark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.offsetWidth;
    const H = () => canvas.offsetHeight;

    const cards = [
      { x: 0.08, y: 0.12, w: 0.38, h: 0.22, label: "Header / Nav",  delay: 0   },
      { x: 0.08, y: 0.40, w: 0.38, h: 0.30, label: "Hero Section",  delay: 0.4 },
      { x: 0.08, y: 0.76, w: 0.18, h: 0.14, label: "CTA Button",    delay: 0.8 },
      { x: 0.54, y: 0.12, w: 0.38, h: 0.38, label: "AI Component",  delay: 0.2 },
      { x: 0.54, y: 0.56, w: 0.18, h: 0.32, label: "Sidebar",       delay: 0.6 },
      { x: 0.74, y: 0.56, w: 0.18, h: 0.32, label: "Data Panel",    delay: 1.0 },
    ];

    const cursorPath = [
      { x: 0.27, y: 0.23 },
      { x: 0.73, y: 0.31 },
      { x: 0.63, y: 0.72 },
      { x: 0.17, y: 0.55 },
      { x: 0.27, y: 0.23 },
    ];

    const draw = (ts: number) => {
      tRef.current = ts / 1000;
      const t = tRef.current;
      const w = W();
      const h = H();
      const { r: ar, g: ag, b: ab } = accentRef.current;

      ctx.clearRect(0, 0, w, h);

      // Background — always a deep dark surface (it's a "screen")
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#0a0a12");
      bg.addColorStop(1, "#0d0d1a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Ambient orbs using accent colour
      [
        { cx: 0.2,  cy: 0.3,  r: 0.28, a: 0.18 },
        { cx: 0.78, cy: 0.65, r: 0.22, a: 0.14 },
        { cx: 0.5,  cy: 0.5,  r: 0.18, a: 0.08 },
      ].forEach(({ cx, cy, r, a }) => {
        const ox = cx * w + Math.sin(t * 0.4 + cx * 10) * 12;
        const oy = cy * h + Math.cos(t * 0.3 + cy * 10) * 10;
        const grad = ctx.createRadialGradient(ox, oy, 0, ox, oy, r * w);
        grad.addColorStop(0, `rgba(${ar},${ag},${ab},${a})`);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      });

      // Grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 32) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }
      for (let gy = 0; gy < h; gy += 32) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }

      // Wireframe cards
      cards.forEach(({ x, y, w: cw, h: ch, label, delay }) => {
        const progress = Math.max(0, Math.min(1, (t * 0.5 - delay) * 1.2));
        if (progress === 0) return;

        const rx = x * w, ry = y * h, rw = cw * w, rh = ch * h;

        ctx.save();
        ctx.globalAlpha = progress * 0.55;
        const cardGrad = ctx.createLinearGradient(rx, ry, rx, ry + rh);
        cardGrad.addColorStop(0, "rgba(255,255,255,0.06)");
        cardGrad.addColorStop(1, "rgba(255,255,255,0.02)");
        ctx.fillStyle = cardGrad;
        roundRect(ctx, rx, ry, rw, rh, 8);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = `rgba(${ar},${ag},${ab},${0.35 * progress})`;
        ctx.lineWidth = 1;
        roundRect(ctx, rx, ry, rw, rh, 8);
        ctx.stroke();

        // Shimmer sweep
        const shimX = ((t * 0.6 + delay) % 1) * rw;
        ctx.save();
        ctx.globalAlpha = 0.12 * progress;
        const shimGrad = ctx.createLinearGradient(rx + shimX - 40, ry, rx + shimX + 40, ry);
        shimGrad.addColorStop(0, "transparent");
        shimGrad.addColorStop(0.5, `rgba(${ar + 60},${ag + 50},255,1)`);
        shimGrad.addColorStop(1, "transparent");
        ctx.fillStyle = shimGrad;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.restore();

        // Label
        ctx.save();
        ctx.globalAlpha = progress * 0.5;
        ctx.fillStyle = `rgba(${ar + 80},${ag + 60},255,1)`;
        ctx.font = `${Math.max(9, w * 0.018)}px Inter, sans-serif`;
        ctx.fillText(label, rx + 10, ry + 18);
        ctx.restore();

        // Skeleton lines
        if (rh > 40) {
          ctx.save();
          ctx.globalAlpha = progress * 0.18;
          ctx.fillStyle = "rgba(255,255,255,0.6)";
          [0.35, 0.55, 0.72].forEach((frac) => {
            if (ry + rh * frac + 4 < ry + rh - 8) {
              roundRect(ctx, rx + 10, ry + rh * frac, rw * 0.6, 4, 2);
              ctx.fill();
            }
          });
          ctx.restore();
        }
      });

      // Connection lines
      [[0, 3], [1, 4], [2, 4], [3, 4], [4, 5]].forEach(([a, b]) => {
        const ca = cards[a], cb = cards[b];
        const ax2 = (ca.x + ca.w / 2) * w, ay2 = (ca.y + ca.h / 2) * h;
        const bx2 = (cb.x + cb.w / 2) * w, by2 = (cb.y + cb.h / 2) * h;
        const pulse = (Math.sin(t * 1.5 + a) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = 0.12 + pulse * 0.08;
        ctx.strokeStyle = `rgba(${ar},${ag},${ab},1)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.lineDashOffset = -t * 12;
        ctx.beginPath();
        ctx.moveTo(ax2, ay2);
        ctx.lineTo(bx2, by2);
        ctx.stroke();
        ctx.restore();
      });

      // Cursor
      const cursorT = (t * 0.18) % 1;
      const seg = cursorT * (cursorPath.length - 1);
      const segIdx = Math.floor(seg);
      const segFrac = seg - segIdx;
      const p0 = cursorPath[Math.min(segIdx, cursorPath.length - 1)];
      const p1 = cursorPath[Math.min(segIdx + 1, cursorPath.length - 1)];
      const cx = (p0.x + (p1.x - p0.x) * segFrac) * w;
      const cy = (p0.y + (p1.y - p0.y) * segFrac) * h;

      const cGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
      cGlow.addColorStop(0, `rgba(${ar + 50},${ag + 50},255,0.4)`);
      cGlow.addColorStop(1, "transparent");
      ctx.fillStyle = cGlow;
      ctx.fillRect(cx - 20, cy - 20, 40, 40);

      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + 10, cy + 14);
      ctx.lineTo(cx + 4,  cy + 12);
      ctx.lineTo(cx + 2,  cy + 18);
      ctx.lineTo(cx - 1,  cy + 17);
      ctx.lineTo(cx + 1,  cy + 11);
      ctx.lineTo(cx - 4,  cy + 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // AI typing dots
      const aiX = 0.54 * w + 10;
      const aiY = 0.12 * h + 30;
      [0, 1, 2].forEach((i) => {
        const bounce = Math.sin(t * 3 + i * 0.8) * 3;
        ctx.save();
        ctx.globalAlpha = 0.6 + Math.sin(t * 3 + i * 0.8) * 0.3;
        ctx.fillStyle = `rgba(${ar + 50},${ag + 50},255,1)`;
        ctx.beginPath();
        ctx.arc(aiX + i * 10, aiY + bounce, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}

// ─── Slide indicator dots ─────────────────────────────────────────────────────
function SlideDots({ total, active }: { total: number; active: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "block rounded-full transition-all duration-500",
            i === active
              ? "w-5 h-1.5 bg-foreground/40"
              : "w-1.5 h-1.5 bg-foreground/15"
          )}
        />
      ))}
    </div>
  );
}

// ─── Main dialog ─────────────────────────────────────────────────────────────
export function StitchUpdateDialog() {
  const [open, setOpen] = useState(false);
  const [activeDot] = useState(0);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Show once per browser session (clears on tab close)
  useEffect(() => {
    const seen = sessionStorage.getItem(STORAGE_KEY);
    if (!seen) {
      const id = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(id);
    }
  }, []);

  const handleClose = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ──────────────────────────────────────────────────── */}
          <motion.div
            key="stitch-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="fixed inset-0 z-[9998] bg-foreground/20 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* ── Dialog ────────────────────────────────────────────────────── */}
          <motion.div
            key="stitch-dialog"
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className={cn(
                "pointer-events-auto relative flex w-full max-w-[900px] overflow-hidden",
                "bg-card border border-border",
                // premium shadow using the project's shadow token
                "shadow-[var(--shadow-lg)]"
              )}
              style={{
                borderRadius: 28,
                minHeight: 480,
                maxHeight: "90vh",
                // Extra depth ring + ambient glow on top of the shadow token
                boxShadow: isDark
                  ? "0 0 0 1px rgba(255,255,255,0.04), var(--shadow-lg), 0 0 80px rgba(80,50,200,0.12)"
                  : "0 0 0 1px rgba(0,0,0,0.04), var(--shadow-lg), 0 0 60px rgba(80,50,200,0.06)",
              }}
            >
              {/* ── Ambient gradient blobs (theme-aware) ──────────────── */}
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden"
                style={{ borderRadius: 28 }}
              >
                <motion.div
                  animate={{ x: [0, 20, -10, 0], y: [0, -15, 10, 0] }}
                  transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -top-24 -left-24 w-72 h-72 rounded-full"
                  style={{
                    background: isDark
                      ? "radial-gradient(circle, rgba(99,60,255,0.14) 0%, transparent 70%)"
                      : "radial-gradient(circle, rgba(99,60,255,0.07) 0%, transparent 70%)",
                    filter: "blur(40px)",
                  }}
                />
                <motion.div
                  animate={{ x: [0, -18, 12, 0], y: [0, 12, -8, 0] }}
                  transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                  className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full"
                  style={{
                    background: isDark
                      ? "radial-gradient(circle, rgba(60,100,255,0.12) 0%, transparent 70%)"
                      : "radial-gradient(circle, rgba(60,100,255,0.06) 0%, transparent 70%)",
                    filter: "blur(40px)",
                  }}
                />
                {/* Noise texture */}
                <div
                  className="absolute inset-0 opacity-[0.025]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
                    backgroundSize: "128px 128px",
                  }}
                />
              </div>

              {/* ── Close button ──────────────────────────────────────── */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-50 flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 hover:bg-accent text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              {/* ── LEFT: Demo canvas (60%) ────────────────────────────── */}
              <div
                className="relative flex-shrink-0 overflow-hidden border-r border-border"
                style={{
                  width: "60%",
                  borderRadius: "28px 0 0 28px",
                }}
              >
                {/* Inner glow */}
                <div
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    borderRadius: "28px 0 0 28px",
                    boxShadow: "inset 0 0 40px rgba(80,50,200,0.06)",
                  }}
                />
                <DemoCanvas isDark={isDark} />

                {/* Bottom label */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-5 py-4 z-10"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(10,8,20,0.88) 0%, transparent 100%)",
                  }}
                >
                  <p className="text-[11px] font-medium tracking-widest uppercase"
                     style={{ color: "rgba(255,255,255,0.28)" }}>
                    Live AI workspace preview
                  </p>
                </div>
              </div>

              {/* ── RIGHT: Content (40%) ──────────────────────────────── */}
              <div className="flex flex-col justify-center px-8 py-10 flex-1 relative z-10">

                {/* "NEW IN STITCH" badge */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5, ease: "easeOut" }}
                  className="flex items-center gap-2 mb-5"
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full",
                      "text-[10px] font-semibold tracking-widest uppercase",
                      "bg-accent text-accent-foreground border border-border"
                    )}
                  >
                    <Sparkles size={9} className="text-muted-foreground" />
                    New in Stitch
                  </span>
                </motion.div>

                {/* Headline */}
                <motion.h2
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35, duration: 0.55, ease: "easeOut" }}
                  className="font-semibold leading-[1.15] tracking-tight text-foreground mb-3"
                  style={{
                    fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Design and prototype
                  <br />
                  {/* Gradient accent on "with AI." — works in both themes */}
                  <span
                    style={{
                      background: isDark
                        ? "linear-gradient(90deg, rgba(160,120,255,1) 0%, rgba(100,160,255,1) 100%)"
                        : "linear-gradient(90deg, rgba(99,60,220,1) 0%, rgba(60,100,220,1) 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    with AI.
                  </span>
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }}
                  className="text-sm leading-relaxed text-muted-foreground mb-7"
                >
                  Transform ideas into intelligent interfaces with Stitch's new
                  collaborative AI workspace.
                </motion.p>

                {/* Feature bullets */}
                <ul className="flex flex-col gap-2.5 mb-8">
                  {FEATURES.map(({ icon: Icon, label }, i) => (
                    <motion.li
                      key={label}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.55 + i * 0.1,
                        duration: 0.45,
                        ease: "easeOut",
                      }}
                      className="flex items-center gap-3"
                    >
                      <span
                        className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-accent border border-border"
                      >
                        <Icon size={11} className="text-muted-foreground" />
                      </span>
                      <span className="text-sm text-foreground/80">
                        {label}
                      </span>
                    </motion.li>
                  ))}
                </ul>

                {/* CTA buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.45, ease: "easeOut" }}
                  className="flex flex-col gap-2.5"
                >
                  {/* Primary — uses --primary / --primary-foreground */}
                  <button
                    onClick={handleClose}
                    className={cn(
                      "group relative flex items-center justify-center gap-2 w-full py-2.5 rounded-xl",
                      "text-sm font-semibold overflow-hidden transition-all duration-300",
                      "bg-primary text-primary-foreground",
                      "hover:opacity-90 hover:-translate-y-px",
                      "shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)]"
                    )}
                  >
                    {/* Shimmer sweep on hover */}
                    <span
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{
                        background:
                          "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)",
                        backgroundSize: "200% 100%",
                        animation: "stitch-shimmer 1.5s ease infinite",
                      }}
                    />
                    <Sparkles size={14} />
                    Try Stitch AI
                    <ArrowRight
                      size={14}
                      className="transition-transform duration-200 group-hover:translate-x-0.5"
                    />
                  </button>

                  {/* Secondary */}
                  <button
                    onClick={handleClose}
                    className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                  >
                    Maybe later
                  </button>
                </motion.div>

                {/* Slide dots */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1, duration: 0.4 }}
                  className="flex justify-center mt-6"
                >
                  <SlideDots total={3} active={activeDot} />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
