import React from "react";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  showTagline?: boolean;
  tagline?: string;
}

export function BrandLogo({ className, showTagline = false, tagline }: BrandLogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-sm ring-1 ring-emerald-400/30">
        <svg
          viewBox="0 0 40 40"
          fill="none"
          aria-hidden="true"
          className="h-6 w-6"
        >
          {/* PDF Document Sheet */}
          <rect
            x="6"
            y="5"
            width="19"
            height="24"
            rx="4"
            fill="white"
            fillOpacity="0.96"
          />
          {/* Medical Cross on Sheet */}
          <path
            d="M15.5 9.5V15.5M12.5 12.5H18.5"
            stroke="#047857"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          {/* Document Lines */}
          <path
            d="M10.5 19.5H20.5M10.5 23.5H17.5"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Friendly Stethoscope Tube & Chestpiece */}
          <path
            d="M16 29V30.5C16 33.5376 18.4624 36 21.5 36H25.5C28.5376 36 31 33.5376 31 30.5V22"
            stroke="#a7f3d0"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <circle cx="31" cy="18.5" r="4.5" fill="white" />
          <circle cx="31" cy="18.5" r="2" fill="#059669" />
        </svg>
      </div>
      <div className="flex flex-col leading-none">
        <span className="text-lg font-extrabold tracking-tight text-foreground">
          dr.<span className="text-emerald-700 dark:text-emerald-400">PdF</span>
          <span className="ml-1 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-foreground align-middle">
            v2
          </span>
        </span>
        {showTagline && tagline && (
          <span className="mt-0.5 text-[11px] font-medium text-muted-foreground truncate max-w-[180px]">
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}
