import React from 'react';
import { cn } from "@/lib/utils";

interface HighlightTextProps {
  children: React.ReactNode;
  className?: string;
  variant?: "lime" | "yellow" | "pink" | "cyan" | "orange";
}

const highlightVariants: Record<NonNullable<HighlightTextProps["variant"]>, string> = {
  lime: "bg-accent-green",
  yellow: "bg-yellow-300",
  pink: "bg-pink-300",
  cyan: "bg-cyan-300",
  orange: "bg-orange-300",
};

export function HighlightText({
  children,
  className,
  variant = "lime",
}: HighlightTextProps) {
  return (
    <span className="relative inline-block align-baseline whitespace-nowrap mx-1.5">
      <span
        className={cn(
          "absolute inset-0 scale-x-105 scale-y-95 -skew-y-1 rounded-sm shadow-sm",
          highlightVariants[variant],
          className
        )}
        aria-hidden="true"
      />
      <span className="relative z-10 font-satisfy font-normal px-2 py-0.5 text-[1.08em] tracking-normal leading-none inline-block text-slate-950">
        {children}
      </span>
    </span>
  );
}

export default HighlightText;
