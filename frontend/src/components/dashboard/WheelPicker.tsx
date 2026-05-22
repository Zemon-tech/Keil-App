"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "motion/react";
import { cn } from "@/lib/utils";

interface WheelPickerProps {
  items: React.ReactNode[];
  itemHeight?: number;
  containerHeight?: number;
  className?: string;
  perspective?: number;
  radius?: number;
  onActiveIndexChange?: (index: number) => void;
}

export function WheelPicker({
  items,
  itemHeight = 130,
  containerHeight = 360,
  className,
  perspective = 1200,
  radius = 200,
  onActiveIndexChange,
}: WheelPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // To simulate infinite scroll, we repeat the items.
  // We'll use a large enough multiplier to make it feel endless,
  // and we'll center it on mount.
  const multiplier = 20;
  const totalItemsCount = items.length * multiplier;
  const virtualItems = Array.from(
    { length: totalItemsCount },
    (_, i) => items[i % items.length],
  );

  const { scrollYProgress } = useScroll({
    container: containerRef,
  });

  // Calculate active index for the dots
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (!containerRef.current) return;
    const scrollableHeight =
      containerRef.current.scrollHeight - containerRef.current.clientHeight;
    const currentScroll = latest * scrollableHeight;
    const rawIndex = Math.round(currentScroll / itemHeight);
    const actualIndex = rawIndex % items.length;
    if (actualIndex !== activeIndex) {
      setActiveIndex(actualIndex);
      onActiveIndexChange?.(actualIndex);
    }

    // Looping logic: if we get too close to the start or end, jump to the middle
    const threshold = items.length * 2;
    if (rawIndex < threshold) {
      containerRef.current.scrollTop += items.length * 10 * itemHeight;
    } else if (rawIndex > totalItemsCount - threshold) {
      containerRef.current.scrollTop -= items.length * 10 * itemHeight;
    }
  });

  useEffect(() => {
    if (containerRef.current) {
      // Start in the middle
      const middleIndex = Math.floor(multiplier / 2) * items.length;
      containerRef.current.scrollTop = middleIndex * itemHeight;
    }
  }, [items.length, itemHeight]);

  return (
    <div
      className={cn(
        "relative overflow-hidden flex flex-col items-center justify-center group",
        className,
      )}
      style={{ height: containerHeight, perspective: `${perspective}px` }}
    >
      <div
        ref={containerRef}
        className="absolute inset-0 overflow-y-scroll snap-y snap-mandatory no-scrollbar overscroll-contain z-10"
        style={{ scrollBehavior: "auto" }} // Auto for jumping
      >
        {/* Padding for centering */}
        <div style={{ height: (containerHeight - itemHeight) / 2 }} />

        {virtualItems.map((_, index) => (
          <div
            key={index}
            className="snap-center shrink-0"
            style={{ height: itemHeight }}
          />
        ))}

        <div style={{ height: (containerHeight - itemHeight) / 2 }} />
      </div>

      {/* The 3D Wheel Container */}
      <div
        className="pointer-events-none relative w-full flex flex-col items-center justify-center preserve-3d z-0"
        style={{ height: itemHeight }}
      >
        {virtualItems.map((item, index) => (
          <WheelItem
            key={index}
            index={index}
            itemHeight={itemHeight}
            containerRef={containerRef}
            radius={radius}
          >
            {item}
          </WheelItem>
        ))}
      </div>

      {/* Dots Indicator - improved positioning and visibility */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-30 pointer-events-none">
        {items.map((_, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={{
              height: activeIndex === i ? 18 : 5,
              width: activeIndex === i ? 4 : 3,
              backgroundColor:
                activeIndex === i
                  ? "var(--primary)"
                  : "color-mix(in srgb, var(--primary) 30%, transparent)",
              opacity: activeIndex === i ? 1 : 0.6,
            }}
            className="rounded-full bg-primary transition-all duration-300 shadow-[0_0_8px_color-mix(in srgb,var(--primary)_30%,transparent)]"
          />
        ))}
      </div>
    </div>
  );
}

interface WheelItemProps {
  index: number;
  itemHeight: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
  radius: number;
}

function WheelItem({
  index,
  itemHeight,
  containerRef,
  children,
  radius,
}: WheelItemProps) {
  const { scrollYProgress } = useScroll({
    container: containerRef,
  });

  const y = useTransform(scrollYProgress, (value) => {
    if (!containerRef.current) return 0;
    const scrollableHeight =
      containerRef.current.scrollHeight - containerRef.current.clientHeight;
    const currentScroll = value * scrollableHeight;
    const itemCenter = index * itemHeight;
    return currentScroll - itemCenter;
  });

  // Refined Apple-style physics
  // We use a slightly tighter rotation and scaling curve
  const rotateX = useTransform(
    y,
    [-radius * 1.5, 0, radius * 1.5],
    [75, 0, -75],
  );
  const opacity = useTransform(
    y,
    [-radius * 1.2, -radius * 0.5, 0, radius * 0.5, radius * 1.2],
    [0, 0.4, 1, 0.4, 0],
  );
  const scale = useTransform(
    y,
    [-radius * 1.2, 0, radius * 1.2],
    [0.75, 1, 0.75],
  );
  const translateZ = useTransform(
    y,
    [-radius * 1.2, 0, radius * 1.2],
    [-radius, 0, -radius],
  );
  const blur = useTransform(
    y,
    [-radius * 1.2, 0, radius * 1.2],
    ["4px", "0px", "4px"],
  );

  // We only render items that are close to the viewport for performance
  const [shouldRender, setShouldRender] = useState(false);

  useMotionValueEvent(y, "change", (latest) => {
    const isVisible = Math.abs(latest) < radius * 2;
    if (isVisible !== shouldRender) {
      setShouldRender(isVisible);
    }
  });

  if (!shouldRender) return null;

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center backface-hidden preserve-3d"
      style={{
        rotateX,
        opacity,
        scale,
        translateZ,
        height: itemHeight,
        filter: blur,
      }}
    >
      <div className="w-full h-full p-2">{children}</div>
    </motion.div>
  );
}
