import Lottie from "lottie-react";

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
  return (
    <div className={className} aria-busy="true" aria-live="polite">
      <div
        className="mx-auto"
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
      >
        <Lottie animationData={animationData} loop autoplay />
      </div>
    </div>
  );
}
