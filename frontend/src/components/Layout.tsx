import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type LayoutProps = {
  children: ReactNode;
  className?: string;
};

export function Layout({ children, className }: LayoutProps) {
  return (
    <div
      className={cn(
        "min-h-screen w-full bg-background text-foreground",
        className
      )}
    >
      <main className="min-h-screen w-full overflow-y-auto overscroll-none">
        {children}
      </main>
    </div>
  );
}
