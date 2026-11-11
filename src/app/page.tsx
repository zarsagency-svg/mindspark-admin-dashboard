"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  ExternalLink,
  Menu,
  MessageSquarePlus,
  Shield,
  Sparkles,
  X,
} from "lucide-react";
import {
  colourHue,
  CUSTOM_COLOURS,
  DEFAULT_PLATFORMS,
  PlatformItem,
} from "@/data/platforms";
import { PlatformFolderCard } from "@/components/PlatformFolderCard";
import { PlatformNeonCard } from "@/components/PlatformNeonCard";
import { NotificationsCenter } from "@/components/NotificationsCenter";
import { AdminDashboard } from "@/components/AdminDashboard";
import {
  GlassChatBubbleIcon,
  GlassPlayIcon,
  GlassSearchIcon,
  GlassShieldIcon,
  GlassStreamIcon,
  GoogleGLogo,
} from "@/components/GlassIcons3D";

export default function HomePage() {
  // View mode: start in Admin Dashboard or Student Portal with 1-click toggle
  const [viewMode, setViewMode] = useState<"portal" | "admin">("admin");
  const [externalDrawerTab, setExternalDrawerTab] = useState<
    "broadcasts" | "message-admin" | null
  >(null);

  const [subscriberCount, setSubscriberCount] = useState<number | null>(14820);
  const [platforms, setPlatforms] = useState<PlatformItem[]>(
    DEFAULT_PLATFORMS.map((p, idx) => ({ ...p, id: idx + 1 }))
  );
  const [palette, setPalette] = useState<"blue" | "red" | "green" | "custom">(
    "blue"
  );
  const [customColour, setCustomColour] = useState("#a855f7");
  const [cardStyle, setCardStyle] = useState<"folder" | "card">("folder");
  const [allowUserThemeOverride, setAllowUserThemeOverride] = useState(true);

  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const customizeRef = useRef<HTMLDivElement>(null);
  const [isPwModalOpen, setIsPwModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "boards" | "jee-neet" | "tools"
  >("all");

  const openPwModal = useCallback(() => setIsPwModalOpen(true), []);

  const fetchPortalData = useCallback(async () => {
    try {
      const [pfRes, setRes, subRes] = await Promise.all([
        fetch("/api/platforms"),
        fetch("/api/settings"),
        fetch("/api/subscribers"),
      ]);

      if (pfRes.ok) {
        const d = await pfRes.json();
        if (Array.isArray(d.platforms) && d.platforms.length > 0) {
          setPlatforms(d.platforms);
        }
      }

      if (setRes.ok) {
        const d = await setRes.json();
        if (d.settings) {
          setPalette(d.settings.palette || "blue");
          setCustomColour(d.settings.customColour || "#a855f7");
          setCardStyle(d.settings.cardStyle || "folder");
          setAllowUserThemeOverride(
            typeof d.settings.allowUserThemeOverride === "boolean"
              ? d.settings.allowUserThemeOverride
              : true
          );
        }
      }

      if (subRes.ok) {
        const d = await subRes.json();
        if (Number.isFinite(d.count)) {
          setSubscriberCount(d.count);
        }
      }
    } catch {
      // Keep default seeded state if offline
    }
  }, []);

  useEffect(() => {
    fetchPortalData();
  }, [fetchPortalData]);

  useEffect(() => {
    if (!isCustomizeOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!customizeRef.current?.contains(event.target as Node)) {
        setIsCustomizeOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsCustomizeOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isCustomizeOpen]);

  const choosePalette = async (
    choice: "blue" | "red" | "green" | "custom"
  ) => {
    setPalette(choice);
    try {
      localStorage.setItem("mindspark-palette", choice);
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palette: choice,
          customColour,
          cardStyle,
          allowUserThemeOverride,
        }),
      });
    } catch {
      // ignore
    }
  };

  const changeCustomColour = async (colour: string) => {
    setCustomColour(colour);
    try {
      localStorage.setItem("mindspark-custom-colour", colour);
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palette: "custom",
          customColour: colour,
          cardStyle,
          allowUserThemeOverride,
        }),
      });
    } catch {
      // ignore
    }
  };

  const chooseCardStyle = async (style: "folder" | "card") => {
    setCardStyle(style);
    try {
      localStorage.setItem("mindspark-platform-style", style);
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          palette,
          customColour,
          cardStyle: style,
          allowUserThemeOverride,
        }),
      });
    } catch {
      // ignore
    }
  };

  // Render Admin Command Center when in 'admin' viewMode
  if (viewMode === "admin") {
    return (
      <AdminDashboard
        onSwitchToPortal={() => {
          fetchPortalData();
          setViewMode("portal");
        }}
        onSettingsUpdated={(next) => {
          setPalette(next.palette);
          setCustomColour(next.customColour);
          setCardStyle(next.cardStyle);
          setAllowUserThemeOverride(next.allowUserThemeOverride);
        }}
        onPlatformsUpdated={fetchPortalData}
      />
    );
  }

  const hueShift = colourHue(customColour) - 220;
  const customStyle = {
    "--custom-colour": customColour,
    "--custom-hue-shift": `${hueShift}deg`,
    "--custom-hue-reverse": `${-hueShift}deg`,
  } as CSSProperties;

  const q = searchQuery.trim().toLowerCase();
  const filteredPlatforms = platforms.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch =
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.metaText.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const mindSparkLetters = "MIND SPARK".split("");

  return (
    <div
      className={`site-shell ${
        palette === "red"
          ? "theme-red"
          : palette === "green"
            ? "theme-green"
            : palette === "custom"
              ? "theme-custom"
              : ""
      } min-h-[100dvh] relative flex flex-col items-center pb-16 overflow-x-hidden`}
      style={customStyle}
    >
      {/* Hidden SEO Content from mindspark-all.vercel.app */}
      <div className="seo-hidden-text">
        <h1>MIND SPARK - The Ultimate Free Education Platform</h1>
        <p>
          Welcome to MIND SPARK, where education must be free for everyone. MIND
          SPARK brings together premium batches, live classes, notes and study
          resources in one place.
        </p>
      </div>

      {/* Soft ambient glows matching reference background */}
      <div
        aria-hidden="true"
        className="ambient-glow fixed top-[-12%] left-1/2 -translate-x-1/2 w-[420px] sm:w-[760px] h-[340px] sm:h-[460px] rounded-full blur-[130px] pointer-events-none z-0"
        style={{ background: "rgba(46,93,230,0.35)" }}
      />
      <div
        aria-hidden="true"
        className="ambient-glow fixed top-[38%] left-1/2 -translate-x-1/2 w-[340px] sm:w-[900px] h-[420px] sm:h-[620px] rounded-full blur-[160px] pointer-events-none z-0"
        style={{ background: "rgba(26,59,176,0.28)" }}
      />
      <div
        aria-hidden="true"
        className="ambient-glow fixed bottom-[-15%] left-1/4 w-[320px] sm:w-[520px] h-[320px] rounded-full blur-[140px] pointer-events-none z-0"
        style={{ background: "rgba(110,146,242,0.16)" }}
      />

      {/* ============================================================
          TOP-LEFT STYLE CUSTOMISER + ADMIN PANEL QUICK ACCESS
      ============================================================ */}
      <div
        ref={customizeRef}
        className="fixed top-4 left-4 sm:top-6 sm:left-7 z-40 flex items-center gap-2.5"
      >
        {allowUserThemeOverride && (
          <button
            type="button"
            aria-label="Customise appearance"
            aria-expanded={isCustomizeOpen}
            aria-controls="customize-panel"
            onClick={() => setIsCustomizeOpen((open) => !open)}
            className="group relative flex items-center gap-2.5 p-1.5 sm:pr-4 rounded-2xl transition-ui duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95 cursor-pointer"
            style={{
              background:
                "linear-gradient(145deg, rgba(175,197,248,0.28) 0%, rgba(46,93,230,0.32) 55%, rgba(15,34,112,0.75) 100%)",
              backdropFilter: "var(--glass-filter)",
              WebkitBackdropFilter: "var(--glass-filter)",
              border: "1px solid rgba(230,237,253,0.45)",
              boxShadow:
                "0 14px 32px -6px rgba(7,16,57,0.8), 0 0 20px rgba(46,93,230,0.35), inset 0 1.5px 2px rgba(230,237,253,0.5)",
            }}
          >
            <span
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl text-[#E6EDFD]"
              style={{
                background:
                  "linear-gradient(145deg, rgba(175,197,248,.4), rgba(46,93,230,.35) 55%, rgba(15,34,112,.7))",
                border: "1px solid rgba(230,237,253,.4)",
                boxShadow:
                  "inset 0 1px 2px rgba(255,255,255,.35), 0 5px 12px rgba(7,16,57,.4)",
              }}
            >
              <Menu aria-hidden="true" className="w-6 h-6" strokeWidth={2.3} />
            </span>
            <span className="hidden sm:flex flex-col items-start text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#AFC5F8] leading-none">
                Your
              </span>
              <span className="text-[13px] font-display font-bold text-[#E6EDFD] leading-tight mt-0.5">
                Style
              </span>
            </span>
          </button>
        )}

        {/* Admin Command Center Button */}
        <button
          type="button"
          onClick={() => setViewMode("admin")}
          className="group relative flex items-center gap-2 p-2 sm:px-3.5 sm:py-2.5 rounded-2xl transition-ui duration-200 hover:-translate-y-0.5 hover:scale-[1.03] active:scale-95 cursor-pointer"
          style={{
            background:
              "linear-gradient(145deg, rgba(175,197,248,0.28) 0%, rgba(46,93,230,0.45) 55%, rgba(15,34,112,0.85) 100%)",
            backdropFilter: "var(--glass-filter)",
            WebkitBackdropFilter: "var(--glass-filter)",
            border: "1px solid rgba(230,237,253,0.5)",
            boxShadow:
              "0 14px 32px -6px rgba(7,16,57,0.8), 0 0 20px rgba(46,93,230,0.35), inset 0 1.5px 2px rgba(230,237,253,0.5)",
          }}
        >
          <Shield className="w-4 h-4 text-[#E6EDFD]" />
          <span className="text-xs font-display font-bold text-[#E6EDFD]">
            Admin Panel
          </span>
        </button>

        {isCustomizeOpen && (
          <section
            id="customize-panel"
            aria-label="Customise appearance"
            className="absolute top-full left-0 mt-3 w-[min(295px,calc(100vw-2rem))] rounded-[22px] p-5 text-[#E6EDFD] max-h-[calc(100dvh-90px)] overflow-y-auto"
            style={{
              background:
                "linear-gradient(155deg, rgba(26,59,176,.96), rgba(7,16,57,.98))",
              border: "1px solid rgba(175,197,248,.4)",
              boxShadow:
                "0 18px 45px rgba(7,16,57,.8), inset 0 1px 2px rgba(230,237,253,.3)",
              backdropFilter: "var(--glass-filter)",
            }}
          >
            <div className="flex items-center justify-between gap-3 mb-5">
              <h2 className="font-display font-bold text-base">Customise</h2>
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(false)}
                aria-label="Close customisation"
                className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="palette-switch mb-5">
              <p className="text-xs font-semibold text-white/80 mb-2">
                Colour palette
              </p>
              <div
                role="group"
                aria-label="Choose colour palette"
                className="grid grid-cols-2 gap-1 p-1 rounded-2xl border border-white/30 bg-black/30"
              >
                {(["blue", "red", "green", "custom"] as const).map((colour) => (
                  <button
                    key={colour}
                    type="button"
                    aria-pressed={palette === colour}
                    onClick={() => choosePalette(colour)}
                    className={`flex flex-1 justify-center items-center gap-1 px-2 py-2 rounded-full text-xs font-bold cursor-pointer ${
                      palette === colour
                        ? "bg-white text-black"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor:
                          colour === "blue"
                            ? "#2E5DE6"
                            : colour === "red"
                              ? "#d00018"
                              : colour === "green"
                                ? "#98BF0A"
                                : customColour,
                      }}
                    />
                    {colour === "blue"
                      ? "Blue"
                      : colour === "red"
                        ? "Red"
                        : colour === "green"
                          ? "Green"
                          : "Custom"}
                  </button>
                ))}
              </div>
              {palette === "custom" && (
                <div className="mt-3 rounded-xl border border-white/25 bg-black/25 px-3 py-3">
                  <p className="mb-2 text-xs font-semibold text-white">
                    Choose a colour
                  </p>
                  <div
                    role="group"
                    aria-label="Choose custom colour"
                    className="grid grid-cols-3 gap-2"
                  >
                    {CUSTOM_COLOURS.map((colour) => (
                      <button
                        key={colour.value}
                        type="button"
                        aria-pressed={customColour === colour.value}
                        onClick={() => changeCustomColour(colour.value)}
                        className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold text-white cursor-pointer ${
                          customColour === colour.value
                            ? "bg-white/20"
                            : "hover:bg-white/10"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-7 w-7 rounded-full border-2 ${
                            customColour === colour.value
                              ? "border-white"
                              : "border-white/30"
                          }`}
                          style={{ backgroundColor: colour.value }}
                        />
                        {colour.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-[#AFC5F8] mb-2">
                Platform style
              </p>
              <div
                role="group"
                aria-label="Choose platform style"
                className="flex gap-1 p-1 rounded-full border border-[#AFC5F8]/30 bg-[#0F2270]/70"
              >
                {(["folder", "card"] as const).map((style) => (
                  <button
                    key={style}
                    type="button"
                    aria-pressed={cardStyle === style}
                    onClick={() => chooseCardStyle(style)}
                    className={`flex-1 px-3 py-2 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                      cardStyle === style
                        ? "bg-[#6E92F2] text-[#071039]"
                        : "text-[#E6EDFD] hover:bg-white/10"
                    }`}
                  >
                    {style === "folder" ? "Folders" : "Cards"}
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ============================================================
          TOP-RIGHT 3D GLASSMORPHIC NOTIFICATIONS & STUDENT INBOX
      ============================================================ */}
      <NotificationsCenter
        externalOpenTab={externalDrawerTab}
        onClearExternalOpen={() => setExternalDrawerTab(null)}
      />

      {/* ============================================================
          MAIN CONTENT CONTAINER
      ============================================================ */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 xl:pt-12 pb-8 flex flex-col items-center justify-center relative z-10 flex-1">
        {/* HERO HEADER: STATIC "MIND SPARK" NAME */}
        <header className="text-center mb-8 w-full flex-shrink-0 relative flex flex-col items-center">
          <h1 className="font-display font-extrabold leading-[1.08] flex flex-col items-center justify-center animate-pop-in select-none">
            <span className="text-xs sm:text-sm font-bold uppercase tracking-[0.32em] text-[#AFC5F8] mb-1.5 flex items-center gap-2">
              <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-[#6E92F2]" />
              <span>Welcome to</span>
              <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-[#6E92F2]" />
            </span>

            <span className="text-[clamp(1.7rem,7.5vw,4.6rem)] tracking-tight inline-flex flex-nowrap items-center justify-center gap-x-[2px]">
              {mindSparkLetters.map((char, idx) =>
                char === " " ? (
                  <span key={idx} className="w-3 sm:w-4" />
                ) : (
                  <span
                    key={idx}
                    className="inline-block mindspark-gradient-text"
                  >
                    {char}
                  </span>
                )
              )}
            </span>
          </h1>

          <p className="text-[#AFC5F8] font-display text-sm sm:text-base mt-3.5 font-medium tracking-wide animate-pop-in flex items-center justify-center flex-wrap gap-1.5">
            <span>Education Must Be</span>
            <span
              className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full font-bold text-[#E6EDFD]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(110,146,242,0.38) 0%, rgba(46,93,230,0.55) 100%)",
                border: "1px solid rgba(230,237,253,0.5)",
                boxShadow:
                  "0 4px 16px rgba(46,93,230,0.45), inset 0 1px 1px rgba(230,237,253,0.45)",
                backdropFilter: "var(--glass-filter)",
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#E6EDFD]" />
              <span>Free</span>
            </span>
            <span>For Everyone</span>
          </p>
        </header>

        {/* DUAL COMMUNITY & DIRECT ADMIN MESSAGE CARDS */}
        <div className="w-full max-w-4xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Card 1: Telegram Community Card */}
          <div className="w-full animate-pop-in relative pt-2.5">
            <div
              className="pointer-events-none absolute top-0 inset-x-6 h-10 rounded-t-2xl"
              style={{
                transform: "rotate(-1.3deg)",
                background:
                  "linear-gradient(90deg, #2E5DE6 0%, #6E92F2 50%, #1A3BB0 100%)",
                border: "1px solid rgba(230,237,253,0.45)",
                boxShadow: "0 8px 24px rgba(46,93,230,0.45)",
              }}
            />

            <a
              href="https://t.me/zarsstudy"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block rounded-[24px] p-4 sm:p-5 overflow-hidden transition-ui duration-200 hover:-translate-y-1 h-full"
              style={{
                background: "var(--community-background)",
                backdropFilter: "var(--glass-filter)",
                WebkitBackdropFilter: "var(--glass-filter)",
                borderTop: "1.5px solid rgba(230,237,253,0.62)",
                borderLeft: "1px solid rgba(230,237,253,0.38)",
                borderRight: "1px solid rgba(175,197,248,0.28)",
                borderBottom: "1.5px solid rgba(7,16,57,0.85)",
                boxShadow:
                  "0 18px 40px -10px rgba(7,16,57,0.85), 0 0 28px rgba(46,93,230,0.28), inset 0 1.5px 2px rgba(230,237,253,0.45)",
              }}
            >
              <div
                className="desktop-sheen pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-500 ease-in-out"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(230,237,253,0.22), transparent)",
                }}
              />

              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3.5 sm:gap-4">
                  <GlassChatBubbleIcon className="w-12 h-12 shrink-0" />
                  <div className="text-left">
                    <h3 className="text-[#E6EDFD] font-display font-bold text-[15px] sm:text-[17px] tracking-tight group-hover:text-white transition-colors">
                      Join Our Telegram
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="w-2 h-2 rounded-full bg-[#6E92F2] shadow-[0_0_8px_#6E92F2]" />
                      <span className="text-[#AFC5F8] text-[11px] sm:text-[12px] font-semibold font-mono uppercase tracking-wider">
                        {subscriberCount !== null
                          ? `${subscriberCount.toLocaleString()} Members`
                          : "Join the community"}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#E6EDFD] transition-ui duration-200 group-hover:scale-110 group-hover:translate-x-0.5 shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #6E92F2 0%, #2E5DE6 100%)",
                    border: "1px solid rgba(230,237,253,0.55)",
                    boxShadow: "0 6px 16px rgba(46,93,230,0.55)",
                  }}
                >
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </a>
          </div>

          {/* Card 2: Student-to-Admin Direct Messaging Card (Google Login) */}
          <div className="w-full animate-pop-in relative pt-2.5">
            <div
              className="pointer-events-none absolute top-0 inset-x-6 h-10 rounded-t-2xl"
              style={{
                transform: "rotate(1.3deg)",
                background:
                  "linear-gradient(90deg, #1A3BB0 0%, #6E92F2 50%, #2E5DE6 100%)",
                border: "1px solid rgba(230,237,253,0.45)",
                boxShadow: "0 8px 24px rgba(46,93,230,0.45)",
              }}
            />

            <button
              type="button"
              onClick={() => setExternalDrawerTab("message-admin")}
              className="w-full group relative block rounded-[24px] p-4 sm:p-5 overflow-hidden transition-ui duration-200 hover:-translate-y-1 text-left cursor-pointer h-full"
              style={{
                background: "var(--community-background)",
                backdropFilter: "var(--glass-filter)",
                WebkitBackdropFilter: "var(--glass-filter)",
                borderTop: "1.5px solid rgba(230,237,253,0.62)",
                borderLeft: "1px solid rgba(230,237,253,0.38)",
                borderRight: "1px solid rgba(175,197,248,0.28)",
                borderBottom: "1.5px solid rgba(7,16,57,0.85)",
                boxShadow:
                  "0 18px 40px -10px rgba(7,16,57,0.85), 0 0 28px rgba(46,93,230,0.28), inset 0 1.5px 2px rgba(230,237,253,0.45)",
              }}
            >
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-3.5 sm:gap-4">
                  <GlassShieldIcon className="w-12 h-12 shrink-0" />
                  <div className="text-left">
                    <h3 className="text-[#E6EDFD] font-display font-bold text-[15px] sm:text-[17px] tracking-tight group-hover:text-white transition-colors">
                      Message Mr Sad (Admin)
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <GoogleGLogo className="w-3.5 h-3.5" />
                      <span className="text-[#AFC5F8] text-[11px] sm:text-[12px] font-semibold">
                        Sign in with Google · Request Batches
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-[#E6EDFD] transition-ui duration-200 group-hover:scale-110 group-hover:translate-x-0.5 shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #6E92F2 0%, #2E5DE6 100%)",
                    border: "1px solid rgba(230,237,253,0.55)",
                    boxShadow: "0 6px 16px rgba(46,93,230,0.55)",
                  }}
                >
                  <MessageSquarePlus className="w-4 h-4" />
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* ============================================================
            CATEGORY PILLS & GLASSMORPHIC SEARCH BAR
        ============================================================ */}
        <div className="w-full max-w-4xl mx-auto mb-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 animate-pop-in">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
            {(
              [
                { id: "all", label: "All Platforms" },
                { id: "boards", label: "Boards" },
                { id: "jee-neet", label: "JEE & NEET" },
                { id: "tools", label: "Study Tools" },
              ] as const
            ).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-2xl font-display font-bold text-xs whitespace-nowrap transition-ui cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[#2E5DE6] text-[#E6EDFD] border border-[#E6EDFD]/50 shadow-md"
                    : "text-[#AFC5F8] hover:text-[#E6EDFD] bg-[#0F2270]/50 border border-[#AFC5F8]/25"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-2xl sm:w-64"
            style={{
              background:
                "linear-gradient(145deg, rgba(175,197,248,0.18) 0%, rgba(15,34,112,0.58) 100%)",
              backdropFilter: "var(--glass-filter)",
              border: "1px solid rgba(175,197,248,0.32)",
            }}
          >
            <GlassSearchIcon className="w-8 h-8 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find platform folder..."
              aria-label="Search MIND SPARK platforms"
              className="w-full bg-transparent text-xs sm:text-[13px] text-[#E6EDFD] placeholder-[#AFC5F8]/65 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear platform search"
                className="text-[#AFC5F8] hover:text-[#E6EDFD] p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ============================================================
            PLATFORMS FOLDER GRID
        ============================================================ */}
        <nav
          id="platforms-container"
          aria-label="MIND SPARK Platforms"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl mx-auto z-10"
        >
          {filteredPlatforms.map((item, index) =>
            cardStyle === "folder" ? (
              <PlatformFolderCard
                key={item.id}
                item={item}
                priority={index < 2}
                onOpenModal={item.isModal ? openPwModal : undefined}
              />
            ) : (
              <PlatformNeonCard
                key={item.id}
                item={item}
                priority={index < 2}
                onOpenModal={item.isModal ? openPwModal : undefined}
              />
            )
          )}
        </nav>

        {filteredPlatforms.length === 0 && (
          <div
            className="w-full max-w-md mx-auto my-8 p-6 rounded-3xl text-center"
            style={{
              background: "rgba(15, 34, 112, 0.45)",
              border: "1px solid rgba(175, 197, 248, 0.25)",
            }}
          >
            <p className="text-[#E6EDFD] font-display font-semibold text-base">
              No platforms match &ldquo;{searchQuery}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategory("all");
              }}
              className="mt-3 px-4 py-1.5 rounded-full text-xs font-semibold text-[#E6EDFD] cursor-pointer"
              style={{
                background: "linear-gradient(135deg, #2E5DE6 0%, #1A3BB0 100%)",
                border: "1px solid rgba(230,237,253,0.4)",
              }}
            >
              Show All Folders
            </button>
          </div>
        )}
      </main>

      {/* ============================================================
          PHYSICS WALLAH DUAL-SERVER MODAL
      ============================================================ */}
      {isPwModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="physics-servers-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPwModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(7, 16, 57, 0.76)",
            backdropFilter: "var(--glass-overlay-filter)",
            WebkitBackdropFilter: "var(--glass-overlay-filter)",
          }}
        >
          <div
            className="relative w-full max-w-md rounded-[28px] p-6 text-[#E6EDFD] overflow-hidden animate-pop-in"
            style={{
              background:
                "linear-gradient(160deg, rgba(46,93,230,0.32) 0%, rgba(15,34,112,0.88) 52%, rgba(7,16,57,0.96) 100%)",
              backdropFilter: "var(--glass-filter)",
              WebkitBackdropFilter: "var(--glass-filter)",
              border: "1.5px solid rgba(230,237,253,0.45)",
              boxShadow:
                "0 25px 60px -12px rgba(7,16,57,0.95), 0 0 40px rgba(46,93,230,0.35), inset 0 1.5px 2px rgba(230,237,253,0.45)",
            }}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <GlassStreamIcon className="w-12 h-12 shrink-0" />
                <div>
                  <h2
                    id="physics-servers-title"
                    className="font-display text-xl font-bold text-[#E6EDFD]"
                  >
                    Physics Wallah
                  </h2>
                  <p className="mt-0.5 text-xs sm:text-sm text-[#AFC5F8]">
                    Choose a high-speed lecture server to continue
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close server selection"
                onClick={() => setIsPwModalOpen(false)}
                className="rounded-full p-2 text-[#AFC5F8] transition-colors hover:bg-[#E6EDFD]/15 hover:text-[#E6EDFD] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3.5">
              {[
                {
                  name: "Server 1",
                  sub: "Rex Lecture Player · Primary Stream",
                  href: "https://rex-lecture-player.vercel.app/",
                  badge: "Fastest",
                },
                {
                  name: "Server 2",
                  sub: "AryaVidya Mirror · Backup Stream",
                  href: "https://stream.aryavidya.cc/index.php#/",
                  badge: "Mirror",
                },
              ].map((srv, idx) => (
                <a
                  key={idx}
                  href={srv.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-center justify-between rounded-2xl p-4 transition-ui duration-200 hover:-translate-y-0.5"
                  style={{
                    background:
                      "linear-gradient(145deg, rgba(175,197,248,0.22) 0%, rgba(26,59,176,0.42) 100%)",
                    backdropFilter: "var(--glass-filter)",
                    border: "1px solid rgba(230,237,253,0.38)",
                    boxShadow:
                      "0 10px 24px -6px rgba(7,16,57,0.65), inset 0 1px 1px rgba(230,237,253,0.35)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <GlassPlayIcon className="w-9 h-9 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-[15px] text-[#E6EDFD] group-hover:text-white">
                          {srv.name}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider text-[#E6EDFD]"
                          style={{
                            background: "rgba(46,93,230,0.55)",
                            border: "1px solid rgba(230,237,253,0.35)",
                          }}
                        >
                          {srv.badge}
                        </span>
                      </div>
                      <p className="text-xs text-[#AFC5F8] mt-0.5">{srv.sub}</p>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-[#AFC5F8] group-hover:text-[#E6EDFD] group-hover:translate-x-0.5 transition-ui" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          FOOTER
      ============================================================ */}
      <footer className="w-full py-5 text-center mt-4 relative z-10 flex-shrink-0 flex flex-col items-center gap-3 animate-pop-in">
        <p className="text-[#AFC5F8]/70 text-[11px] font-semibold tracking-[0.22em] uppercase">
          © 2026 MIND SPARK · Managed by Mr Sad Admin Studio
        </p>
      </footer>
    </div>
  );
}
