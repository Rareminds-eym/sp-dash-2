"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedGridPatternProps {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  strokeDasharray?: string;
  numSquares?: number;
  className?: string;
  maxOpacity?: number;
  duration?: number;
  repeatDelay?: number;
}

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  x = -1,
  y = -1,
  strokeDasharray = "0",
  numSquares = 50,
  className,
  maxOpacity = 0.5,
  duration = 4,
  repeatDelay = 0.5,
  ...props
}: AnimatedGridPatternProps) {
  const id = useId();
  const containerRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [squares, setSquares] = useState(() => generateSquares(numSquares));

  function generateSquares(count: number) {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      pos: [
        Math.floor(Math.random() * 100),
        Math.floor(Math.random() * 100),
      ],
    }));
  }

  useEffect(() => {
    if (dimensions.width && dimensions.height) {
      setSquares(generateSquares(numSquares));
    }
  }, [dimensions, numSquares]);
  
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return null;
  }

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className
      )}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <path
            d={`M.5 ${height}V.5H${width}`}
            fill="none"
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
      <svg x={x} y={y} className="overflow-visible">
        {squares.map(({ pos: [x, y], id }, index) => (
          <rect
            key={`${id}-${index}`}
            width={width - 1}
            height={height - 1}
            x={(x ?? 0) * width + 1}
            y={(y ?? 0) * height + 1}
            fill="currentColor"
            strokeWidth="0"
            className="animate-pulse"
            style={{
              opacity: Math.random() * maxOpacity,
              animationDelay: `${Math.random() * duration + repeatDelay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        ))}
      </svg>
    </svg>
  );
}
