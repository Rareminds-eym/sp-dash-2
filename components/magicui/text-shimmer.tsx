"use client";

import { CSSProperties, FC, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TextShimmerProps {
  children: ReactNode;
  className?: string;
  shimmerWidth?: number;
  duration?: number;
  spread?: number;
  as?: React.ElementType;
}

const TextShimmer: FC<TextShimmerProps> = ({
  children,
  className,
  shimmerWidth = 100,
  duration = 2,
  spread = 2,
  as: Component = "p",
}) => {
  return (
    <Component
      style={
        {
          "--shimmer-width": `${shimmerWidth}px`,
          "--shimmer-duration": `${duration}s`,
          "--shimmer-spread": `${spread}`,
        } as CSSProperties
      }
      className={cn(
        "relative inline-block",
        // Shimmer effect
        "[background:linear-gradient(110deg,transparent_0%,transparent_40%,rgba(255,255,255,0.6)_50%,transparent_60%,transparent_100%)] bg-[length:var(--shimmer-width)_100%] bg-clip-text bg-no-repeat text-transparent",
        // Animation
        "animate-shimmer",
        className
      )}
    >
      {children}
    </Component>
  );
};

export default TextShimmer;
