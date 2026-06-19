import React, { useState, useEffect } from "react";
import { Laptop, Smartphone, Terminal } from "lucide-react";

interface MobileBlockerProps {
  children: React.ReactNode;
}

export function MobileBlocker({ children }: MobileBlockerProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-background text-foreground p-6 overflow-hidden select-none font-sans">
      {/* Dynamic inline stylesheet for custom easings and keyframes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes custom-fade-in-up {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .animate-stagger-1 {
          animation: custom-fade-in-up 240ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }

        .animate-stagger-2 {
          opacity: 0;
          animation: custom-fade-in-up 240ms cubic-bezier(0.23, 1, 0.32, 1) 50ms forwards;
        }

        .animate-stagger-3 {
          opacity: 0;
          animation: custom-fade-in-up 240ms cubic-bezier(0.23, 1, 0.32, 1) 100ms forwards;
        }

        .animate-stagger-4 {
          opacity: 0;
          animation: custom-fade-in-up 240ms cubic-bezier(0.23, 1, 0.32, 1) 150ms forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-stagger-1,
          .animate-stagger-2,
          .animate-stagger-3,
          .animate-stagger-4 {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}} />

      {/* Content Container */}
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-8">
        
        {/* Brand Terminal Logo (Restrained) */}
        <div className="flex items-center space-x-2 bg-secondary border border-border px-3 py-1.5 rounded-lg animate-stagger-1">
          <Terminal className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span className="text-xs font-semibold text-foreground">Keil Desktop</span>
        </div>

        {/* Visual Device Graphics */}
        <div className="relative flex items-center justify-center w-28 h-28 animate-stagger-2">
          {/* Symmetrical border container */}
          <div className="absolute inset-0 rounded-xl border border-border bg-card" />
          
          <Laptop className="relative z-10 w-10 h-10 text-zinc-500 dark:text-zinc-400" />
          
          {/* Smartphone indicator */}
          <div className="absolute -bottom-1 -right-1 bg-card border border-border p-2 rounded-lg shadow-sm flex items-center justify-center z-20">
            <Smartphone className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
            <span className="absolute top-1 right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </div>
        </div>

        {/* Typography Block */}
        <div className="space-y-3 animate-stagger-3">
          <h1 className="text-xl font-bold tracking-[-0.03em] text-foreground text-wrap-balance">
            Optimized for Desktop
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed max-w-[280px] mx-auto text-wrap-pretty">
            Keil is currently built for desktop viewports. The mobile edition is in active development.
          </p>
        </div>

        {/* Informative Step */}
        <div className="w-full bg-secondary border border-border rounded-xl p-4 text-left animate-stagger-4">
          <h4 className="text-xs font-semibold text-foreground">How to access</h4>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Please open this application link on a laptop or desktop monitor to access your workspace.
          </p>
        </div>

        {/* Footer */}
        <div className="text-[10px] text-muted-foreground font-medium animate-stagger-4">
          © {new Date().getFullYear()} Keil App
        </div>
      </div>
    </div>
  );
}
