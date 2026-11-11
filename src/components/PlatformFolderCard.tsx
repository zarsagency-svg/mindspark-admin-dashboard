"use client";

import React from "react";
import { PlatformItem } from "@/data/platforms";

interface PlatformFolderCardProps {
  item: PlatformItem;
  priority?: boolean;
  onOpenModal?: () => void;
}

export const PlatformFolderCard = React.memo(function PlatformFolderCard({
  item,
  priority = false,
  onOpenModal,
}: PlatformFolderCardProps) {
  const isInteractive = Boolean(item.href || item.isModal);

  const FolderVisual = (
    <div className="group relative w-full aspect-[280/242] select-none transition-ui duration-200 ease-out hover:-translate-y-2">
      {/* Ambient Ultramarine Floor Shadow & Hover Glow */}
      <div
        className="pointer-events-none absolute -bottom-3 inset-x-5 h-10 rounded-full opacity-70 transition-ui duration-200 group-hover:opacity-100 group-hover:scale-105"
        style={{
          background:
            "radial-gradient(ellipse at center, color-mix(in srgb, var(--ultra-600) 65%, transparent) 0%, color-mix(in srgb, var(--ultra-900) 45%, transparent) 55%, color-mix(in srgb, var(--ultra-950) 0%, transparent) 80%)",
        }}
      />

      {/* LAYER 1: FOLDER BACK PLATE WITH CURVED TOP-LEFT TAB */}
      <svg
        viewBox="0 0 280 242"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="folder-backplate absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={`folderBack-${item.id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="var(--ultra-400)" />
            <stop offset="28%" stopColor={item.accentShade || "#2E5DE6"} />
            <stop offset="72%" stopColor="var(--ultra-800)" />
            <stop offset="100%" stopColor="var(--ultra-900)" />
          </linearGradient>
          <linearGradient
            id={`folderRim-${item.id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="40%"
          >
            <stop offset="0%" stopColor="var(--ultra-50)" stopOpacity="0.8" />
            <stop offset="50%" stopColor="var(--ultra-200)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--ultra-400)" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient
            id={`folderInnerShadow-${item.id}`}
            x1="50%"
            y1="0%"
            x2="50%"
            y2="100%"
          >
            <stop offset="0%" stopColor="var(--ultra-950)" stopOpacity="0.08" />
            <stop offset="100%" stopColor="var(--ultra-950)" stopOpacity="0.58" />
          </linearGradient>
        </defs>

        <path
          d="M 0 30
             C 0 13.4 13.4 0 30 0
             L 94 0
             C 108 0 115 7 122 19
             C 128 29 135 35 149 35
             L 250 35
             C 266.6 35 280 48.4 280 65
             L 280 212
             C 280 228.6 266.6 242 250 242
             L 30 242
             C 13.4 242 0 228.6 0 212
             Z"
          fill={`url(#folderBack-${item.id})`}
        />

        <path
          d="M 4 32
             C 4 16.5 16.5 4 32 4
             L 93 4
             C 106 4 112 10 119 21
             C 125 31 133 38 148 38
             L 248 38
             C 263.5 38 276 50.5 276 66
             L 276 210
             C 276 225.5 263.5 238 248 238
             L 32 238
             C 16.5 238 4 225.5 4 210
             Z"
          fill={`url(#folderInnerShadow-${item.id})`}
        />

        <path
          d="M 1.2 30
             C 1.2 14.1 14.1 1.2 30 1.2
             L 94 1.2
             C 107.5 1.2 114.2 7.8 121 19.5
             C 127.2 29.8 134.5 36.2 149 36.2
             L 250 36.2
             C 265.9 36.2 278.8 49.1 278.8 65
             L 278.8 212
             C 278.8 227.9 265.9 240.8 250 240.8
             L 30 240.8
             C 14.1 240.8 1.2 227.9 1.2 212
             Z"
          stroke={`url(#folderRim-${item.id})`}
          strokeWidth="2"
        />
      </svg>

      {/* LAYER 2: INSIDE THE FOLDER POCKET (WHITE SLEEVE + TILTED PLATFORM LOGO CARD) */}
      <div className="absolute inset-x-[7.5%] top-[17.5%] bottom-[8%] pointer-events-none flex items-start justify-center">
        <div
          className="w-full h-[58%] rounded-[16px] transition-transform duration-200 ease-out group-hover:-translate-y-1"
          style={{
            background:
              "linear-gradient(180deg, var(--ultra-50) 0%, var(--ultra-200) 48%, color-mix(in srgb, var(--ultra-400) 35%, transparent) 100%)",
            boxShadow:
              "0 -2px 10px color-mix(in srgb, var(--ultra-950) 28%, transparent), inset 0 2px 2px rgba(255,255,255,0.9)",
            border: "1px solid color-mix(in srgb, var(--ultra-50) 85%, transparent)",
          }}
        />

        <div
          className="absolute -top-[10%] right-[10%] sm:right-[11%] w-[44%] aspect-square rounded-[20px] p-1.5 transition-ui duration-200 ease-out group-hover:-translate-y-3.5 group-hover:scale-105"
          style={{
            transform: `rotate(${item.tiltAngle}deg)`,
            background:
              "linear-gradient(145deg, var(--ultra-950) 0%, var(--ultra-900) 65%, var(--ultra-800) 100%)",
            border: "2px solid color-mix(in srgb, var(--ultra-50) 78%, transparent)",
            boxShadow: "var(--folder-logo-shadow)",
          }}
        >
          <div className="relative w-full h-full rounded-[14px] overflow-hidden bg-abyss flex items-center justify-center">
            <img
              src={item.imgSrc}
              alt={item.imgAlt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              width={240}
              height={240}
              className={`w-full h-full ${
                item.objectFit === "contain"
                  ? "object-contain p-1.5"
                  : "object-cover"
              } rounded-[12px]`}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--ultra-50) 32%, transparent) 0%, color-mix(in srgb, var(--ultra-50) 0%, transparent) 52%)",
              }}
            />
          </div>
        </div>
      </div>

      {/* LAYER 3: FROSTED GLASSMORPHISM FRONT FOLDER POCKET */}
      <div
        className="folder-pocket absolute inset-x-0 bottom-0 h-[71.5%] rounded-[22px] overflow-hidden flex flex-col justify-between p-3.5 sm:p-4 transition-ui duration-200"
        style={{
          background: "var(--folder-pocket-background)",
          backdropFilter: "var(--glass-folder-filter)",
          WebkitBackdropFilter: "var(--glass-folder-filter)",
          borderTop: "1.5px solid color-mix(in srgb, var(--ultra-50) 68%, transparent)",
          borderLeft: "1px solid color-mix(in srgb, var(--ultra-50) 42%, transparent)",
          borderRight: "1px solid color-mix(in srgb, var(--ultra-200) 32%, transparent)",
          borderBottom: "1.5px solid color-mix(in srgb, var(--ultra-900) 75%, transparent)",
          boxShadow:
            "0 -6px 20px color-mix(in srgb, var(--ultra-950) 32%, transparent), inset 0 2px 3px color-mix(in srgb, var(--ultra-50) 48%, transparent), inset 0 -6px 14px color-mix(in srgb, var(--ultra-900) 55%, transparent)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-[9px] sm:inset-[11px] rounded-[16px]"
          style={{
            background:
              "linear-gradient(165deg, color-mix(in srgb, var(--ultra-50) 16%, transparent) 0%, color-mix(in srgb, var(--ultra-400) 6%, transparent) 55%, color-mix(in srgb, var(--ultra-900) 22%, transparent) 100%)",
            boxShadow:
              "0 8px 16px color-mix(in srgb, var(--ultra-950) 28%, transparent), inset 0 1.5px 2px color-mix(in srgb, var(--ultra-50) 38%, transparent), inset 0 -2px 4px color-mix(in srgb, var(--ultra-900) 32%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ultra-50) 22%, transparent)",
          }}
        />

        <div
          className="desktop-sheen pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-out"
          style={{
            background:
              "linear-gradient(105deg, transparent 20%, color-mix(in srgb, var(--ultra-50) 26%, transparent) 50%, transparent 80%)",
          }}
        />

        <div className="relative z-10 flex items-start justify-between gap-2 px-1.5 pt-0.5">
          <div className="text-left min-w-0">
            <h2 className="font-display font-bold text-[15px] sm:text-[17px] leading-tight tracking-tight text-ink truncate group-hover:text-white transition-colors">
              {item.name}
            </h2>
            <p className="text-[11px] sm:text-[12px] font-medium text-ink/80 truncate mt-0.5">
              {item.subtitle}
            </p>
          </div>

          <div
            className="shrink-0 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-ui duration-200 group-hover:scale-110 group-hover:bg-ink/25"
            style={{
              border: "1.25px solid color-mix(in srgb, var(--ultra-50) 75%, transparent)",
              background: "color-mix(in srgb, var(--ultra-50) 12%, transparent)",
              boxShadow: "0 2px 8px color-mix(in srgb, var(--ultra-950) 25%, transparent)",
            }}
          >
            <svg
              viewBox="0 0 16 16"
              className="w-3.5 h-3.5 text-ink"
              fill="currentColor"
            >
              <circle cx="8" cy="3.5" r="1.2" />
              <circle cx="8" cy="8" r="1.2" />
              <circle cx="8" cy="12.5" r="1.2" />
            </svg>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between px-1.5 pb-0.5">
          <span className="text-[10px] sm:text-[11px] font-medium tracking-wide text-ink/90 truncate">
            {item.metaText}
          </span>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ink opacity-90 group-hover:opacity-100 transition-opacity"
            style={{
              background: "color-mix(in srgb, var(--ultra-950) 38%, transparent)",
              border: "1px solid color-mix(in srgb, var(--ultra-50) 30%, transparent)",
            }}
          >
            <span>Open</span>
            <svg
              viewBox="0 0 12 12"
              className="w-2.5 h-2.5 transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M2.5 6H9.5M9.5 6L6.5 3M9.5 6L6.5 9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );

  if (item.isModal) {
    return (
      <button
        type="button"
        title={item.title}
        aria-haspopup="dialog"
        onClick={onOpenModal}
        className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-glow rounded-[24px] animate-pop-in"
      >
        {FolderVisual}
      </button>
    );
  }

  if (isInteractive && item.href) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        title={item.title}
        className="block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-glow rounded-[24px] animate-pop-in"
      >
        {FolderVisual}
      </a>
    );
  }

  return (
    <div
      title={`${item.name} - Coming Soon`}
      aria-disabled="true"
      className="w-full cursor-default select-none animate-pop-in"
    >
      {FolderVisual}
    </div>
  );
});
