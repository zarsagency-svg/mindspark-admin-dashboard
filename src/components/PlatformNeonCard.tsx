"use client";

import React from "react";
import { PlatformItem } from "@/data/platforms";

interface PlatformNeonCardProps {
  item: PlatformItem;
  onOpenModal?: () => void;
  priority?: boolean;
}

export const PlatformNeonCard: React.FC<PlatformNeonCardProps> = ({
  item,
  onOpenModal,
  priority = false,
}) => {
  const isInteractive = Boolean(item.href || item.isModal);
  const accent = item.accentShade || "#2E5DE6";

  const CardVisual = (
    <div
      className="group relative w-full aspect-[3/4] select-none rounded-[22px] overflow-hidden transition-all duration-500 ease-out hover:-translate-y-2 flex flex-col items-center px-3.5 py-5"
      style={{
        background:
          "linear-gradient(165deg, #0F2270 0%, #0A1A5E 45%, #071039 100%)",
        border: `1.5px solid ${accent}`,
        boxShadow: `0 0 14px ${accent}55, 0 0 34px ${accent}26, inset 0 0 22px ${accent}1f, 0 18px 30px -12px rgba(7,16,57,0.85)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-6 top-0 h-[2px] rounded-full opacity-80 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
          boxShadow: `0 0 12px ${accent}`,
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out z-20"
        style={{
          background:
            "linear-gradient(105deg, transparent 20%, rgba(230,237,253,0.18) 50%, transparent 80%)",
        }}
      />

      <div className="flex-1 w-full flex items-center justify-center min-h-0">
        <div
          className="h-full max-h-[130px] aspect-square rounded-[20px] p-[3px] transition-all duration-500 ease-out group-hover:scale-110 group-hover:-rotate-2"
          style={{
            background: `linear-gradient(150deg, ${accent}, #071039 70%)`,
            boxShadow: `0 0 20px ${accent}88, 0 0 44px ${accent}44, 0 10px 22px -6px rgba(7,16,57,0.9)`,
          }}
        >
          <div className="relative w-full h-full rounded-[17px] overflow-hidden bg-[#071039] flex items-center justify-center">
            <img
              src={item.imgSrc}
              alt={item.imgAlt}
              loading={priority ? "eager" : "lazy"}
              decoding="async"
              className={`w-full h-full ${
                item.objectFit === "contain"
                  ? "object-contain p-1.5"
                  : "object-cover"
              }`}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(230,237,253,0.28) 0%, rgba(230,237,253,0) 52%)",
              }}
            />
          </div>
        </div>
      </div>

      <h2 className="shrink-0 font-display font-bold text-base sm:text-lg leading-tight tracking-tight text-[#E6EDFD] text-center truncate max-w-full group-hover:text-white transition-colors pt-3">
        {item.name}
      </h2>

      <div
        className="pointer-events-none absolute inset-0 rounded-[22px] opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          boxShadow: `inset 0 0 34px ${accent}40, 0 0 30px ${accent}55`,
        }}
      />
    </div>
  );

  if (item.isModal) {
    return (
      <button
        type="button"
        title={item.title}
        aria-haspopup="dialog"
        onClick={onOpenModal}
        className="w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6E92F2] rounded-[22px] animate-pop-in"
      >
        {CardVisual}
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
        className="block w-full text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6E92F2] rounded-[22px] animate-pop-in"
      >
        {CardVisual}
      </a>
    );
  }

  return (
    <div
      title={`${item.name} - Coming Soon`}
      aria-disabled="true"
      className="w-full cursor-default select-none animate-pop-in"
    >
      {CardVisual}
    </div>
  );
};
