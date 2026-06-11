import { useMemo } from "react";
import Lottie from "lottie-react";
import { useTheme } from "next-themes";

import animationData from "@/assets/Scene-1.json";

type LogoLoaderProps = {
  className?: string;
  size?: number;
  label?: string;
};

export function LogoLoader({
  className,
  size = 220,
  label = "Loading...",
}: LogoLoaderProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const adjustedAnimationData = useMemo(() => {
    if (!isDark) return animationData;

    try {
      const cloned = JSON.parse(JSON.stringify(animationData));

      // App background in dark mode: #0d0d0d -> normalized to [0..1]
      const bgCol = [13 / 255, 13 / 255, 13 / 255];
      // App text/foreground in dark mode: #f5f5f5 -> normalized to [0..1]
      const fgCol = [245 / 255, 245 / 255, 245 / 255];

      const traverse = (obj: any) => {
        if (!obj || typeof obj !== "object") return;

        if (obj.ty === "fl" && obj.c && Array.isArray(obj.c.k)) {
          const color = obj.c.k;
          const r = color[0];
          const g = color[1];
          const b = color[2];

          // White background
          if (r === 1 && g === 1 && b === 1) {
            obj.c.k = bgCol.slice(0, color.length);
          }
          // Black foreground icon parts
          else if (r === 0 && g === 0 && b === 0) {
            const alpha = color.length > 3 ? color[3] : undefined;
            const target = alpha !== undefined ? [...fgCol, alpha] : [...fgCol];
            obj.c.k = target;
          }
        }

        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            traverse(obj[key]);
          }
        }
      };

      traverse(cloned);
      return cloned;
    } catch (e) {
      console.error("Failed to adjust Lottie animation colors", e);
      return animationData;
    }
  }, [isDark]);

  return (
    <div className={className} aria-busy="true" aria-live="polite">
      <div
        className="mx-auto"
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
      >
        <Lottie animationData={adjustedAnimationData} loop autoplay />
      </div>
    </div>
  );
}
