import { Sparkles, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useTaskSummary, useRegenerateTaskSummary } from "@/hooks/api/useTaskSummary";
import type { TaskDTO } from "@/hooks/api/useTasks";
import { cn } from "@/lib/utils";

// ─── Animated Orb Icon ────────────────────────────────────────────────────────

function AiOrb({ isGenerating }: { isGenerating: boolean }) {
  return (
    <div className="relative flex items-center justify-center size-7 shrink-0">
      {/* Outer glow ring — visible during generation */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: "conic-gradient(from 0deg, #a78bfa, #818cf8, #c084fc, #a78bfa)",
          opacity: 0,
        }}
        animate={isGenerating ? {
          opacity: [0.4, 0.7, 0.4],
          scale: [1, 1.15, 1],
          rotate: [0, 360],
        } : { opacity: 0, scale: 1 }}
        transition={isGenerating ? {
          opacity: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
          rotate: { duration: 3, repeat: Infinity, ease: "linear" },
        } : { duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      />
      {/* Soft blur behind orb */}
      <motion.div
        className="absolute inset-0.5 rounded-full blur-[3px]"
        style={{
          background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #c084fc 100%)",
        }}
        animate={isGenerating ? { opacity: [0.3, 0.5, 0.3] } : { opacity: 0.2 }}
        transition={isGenerating ? {
          duration: 1.6, repeat: Infinity, ease: "easeInOut",
        } : { duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      />
      {/* Core orb */}
      <motion.div
        className="relative flex items-center justify-center size-7 rounded-full"
        style={{
          background: "linear-gradient(135deg, #a78bfa 0%, #818cf8 50%, #c084fc 100%)",
        }}
        animate={isGenerating ? { scale: [1, 0.92, 1] } : { scale: 1 }}
        transition={isGenerating ? {
          duration: 1.6, repeat: Infinity, ease: "easeInOut",
        } : { duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      >
        <Sparkles className="size-3.5 text-white" strokeWidth={2.5} />
      </motion.div>
    </div>
  );
}

// ─── Generating Indicator ─────────────────────────────────────────────────────

function GeneratingIndicator() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="size-1.5 rounded-full bg-violet-400/70"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.1, 0.85] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.2,
          }}
        />
      ))}
      <span className="ml-1.5 text-xs text-muted-foreground/70 font-medium">
        Generating summary
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ActivityAiSummaryProps {
  task: TaskDTO;
  orgId: string | null;
  spaceId: string | null;
  commentCount: number;
}

export function ActivityAiSummary({ task, orgId, spaceId, commentCount }: ActivityAiSummaryProps) {
  const { data: summary, isLoading, isFetching } = useTaskSummary(orgId, spaceId, task.id);
  const regenerateMutation = useRegenerateTaskSummary(orgId, spaceId);

  const isGenerating = regenerateMutation.isPending || (isFetching && !summary);
  const hasSummary = !!summary?.summary_text;

  // Don't render anything if there are no comments and no summary
  if (commentCount === 0 && !hasSummary && !isLoading) return null;

  // Still loading initial data
  if (isLoading && !hasSummary) return null;

  // No summary generated yet but has comments — backend will auto-generate
  const isWaitingForFirstGeneration = !hasSummary && commentCount > 0 && !isGenerating;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="mx-8 mb-5"
    >
      <div
        className={cn(
          "relative rounded-2xl overflow-hidden transition-shadow duration-500",
          "bg-card dark:bg-card",
          "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]",
          "dark:shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.15)]",
        )}
      >
        {/* Static border */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl pointer-events-none",
            "border border-border/60 dark:border-white/6",
            isGenerating && "border-transparent",
          )}
        />

        {/* Animated rotating border during generation */}
        {isGenerating && (
          <motion.div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              padding: "1px",
              background: "conic-gradient(from var(--angle, 0deg), transparent 40%, #a78bfa 50%, #818cf8 55%, #c084fc 60%, transparent 70%)",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
            animate={{ "--angle": ["0deg", "360deg"] } as Record<string, string[]>}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
        )}

        {/* ── Header row ── */}
        <div className="w-full flex items-center gap-3 px-4 py-3.5 text-left select-none">
          {/* AI Orb */}
          <AiOrb isGenerating={isGenerating} />

          {/* Label */}
          <span className="text-[13px] font-semibold text-foreground/90 flex-1 tracking-[-0.01em]">
            AI Summary
          </span>

          {/* Regenerate button */}
          {hasSummary && !isGenerating && (
            <motion.button
              onClick={() => regenerateMutation.mutate(task.id)}
              title="Regenerate summary"
              className={cn(
                "p-1.5 rounded-lg cursor-pointer",
                "opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100",
                "hover:bg-muted active:scale-[0.95]",
                "text-muted-foreground/60 hover:text-muted-foreground",
                "transition-all duration-200 ease-out",
              )}
              whileTap={{ scale: 0.92 }}
            >
              <RefreshCw className="size-3.5" />
            </motion.button>
          )}
        </div>

        {/* ── Body ── */}
        <AnimatePresence initial={false}>
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
              opacity: { duration: 0.2, ease: "easeOut" },
            }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0.5 pl-[60px]">
              {isGenerating || isWaitingForFirstGeneration ? (
                <GeneratingIndicator />
              ) : hasSummary ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="text-[13px] leading-[1.7] text-foreground/75 font-[420]"
                >
                  {summary.summary_text}
                </motion.p>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
