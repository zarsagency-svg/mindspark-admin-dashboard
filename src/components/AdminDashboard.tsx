"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  BellRing,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  FolderPlus,
  Heart,
  Inbox,
  Layers,
  LogOut,
  MailCheck,
  MessageSquare,
  Palette,
  Pin,
  Plus,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  CUSTOM_COLOURS,
  generateCustomPlatformSvg,
  PlatformItem,
  PRESET_PLATFORM_LOGOS,
  ULTRAMARINE_PALETTE,
} from "@/data/platforms";
import { PlatformFolderCard } from "./PlatformFolderCard";
import { PlatformNeonCard } from "./PlatformNeonCard";
import {
  GlassChatBubbleIcon,
  GlassEnvelopeNotificationIcon,
  GlassShieldIcon,
  GoogleGLogo,
} from "./GlassIcons3D";
import type { AnnouncementItem } from "./types";
import { AdminChat } from "./AdminChat";
import { PUBLIC_SITE_URL } from "@/lib/config";
import { adminFetch } from "@/lib/supabase";

interface SiteSettingsData {
  palette: "blue" | "red" | "green" | "custom";
  customColour: string;
  cardStyle: "folder" | "card";
  allowUserThemeOverride: boolean;
  telegramChannel: string;
}

interface AdminDashboardProps {
  /** The allowlisted Google account currently signed in. */
  adminEmail?: string;
  /** Ends the Supabase session. */
  onSignOut?: () => void;
}

type AdminSection = "broadcasts" | "inbox" | "platforms" | "appearance";

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminEmail = "",
  onSignOut,
}) => {
  const [activeSection, setActiveSection] =
    useState<AdminSection>("broadcasts");

  // Data states
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  /** Total unread chat bubbles, reported up by the AdminChat module. */
  const [chatUnread, setChatUnread] = useState(0);
  const [platformsList, setPlatformsList] = useState<PlatformItem[]>([]);
  const [settings, setSettings] = useState<SiteSettingsData>({
    palette: "blue",
    customColour: "#a855f7",
    cardStyle: "folder",
    allowUserThemeOverride: true,
    telegramChannel: "https://t.me/zarsstudy",
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  // Module 1: Broadcast Composer State
  const [bcTitle, setBcTitle] = useState("");
  const [bcText, setBcText] = useState("");
  const [bcTag, setBcTag] = useState("Official Broadcast");
  const [bcImageUrl, setBcImageUrl] = useState("");
  const [bcPinned, setBcPinned] = useState(false);
  const [isPublishingBc, setIsPublishingBc] = useState(false);

  // Module 2 (chat) owns its own state inside <AdminChat />.

  // Module 3: Platform Form State
  const [editingPlatformId, setEditingPlatformId] = useState<number | null>(
    null
  );
  const [pfName, setPfName] = useState("");
  const [pfSubtitle, setPfSubtitle] = useState("");
  const [pfMetaText, setPfMetaText] = useState("Free Access · Live & Recorded");
  const [pfCategory, setPfCategory] = useState<"boards" | "jee-neet" | "tools">(
    "boards"
  );
  const [pfHref, setPfHref] = useState("");
  const [pfIsModal, setPfIsModal] = useState(false);
  const [pfImgSrc, setPfImgSrc] = useState("");
  const [pfObjectFit, setPfObjectFit] = useState<"cover" | "contain">("cover");
  const [pfTiltAngle, setPfTiltAngle] = useState(-9);
  const [pfAccentShade, setPfAccentShade] = useState("#2E5DE6");
  const [previewMode, setPreviewMode] = useState<"folder" | "card">("folder");
  const [isSavingPlatform, setIsSavingPlatform] = useState(false);

  // Module 4: Appearance saving state
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? "" : prev));
    }, 4000);
  };

  const fetchAllAdminData = async () => {
    setIsLoadingData(true);
    try {
      const [annRes, pfRes, setRes] = await Promise.all([
        adminFetch("/api/announcements"),
        adminFetch("/api/platforms"),
        adminFetch("/api/settings"),
      ]);

      if (annRes.ok) {
        const d = await annRes.json();
        setAnnouncements(d.announcements || []);
      }
      if (pfRes.ok) {
        const d = await pfRes.json();
        setPlatformsList(d.platforms || []);
      }
      if (setRes.ok) {
        const d = await setRes.json();
        if (d.settings) {
          setSettings(d.settings);
        }
      }
    } catch {
      showToast("Could not refresh some dashboard data.");
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    fetchAllAdminData();
  }, []);

  // The whole theme hangs off one variable: globals.css derives the 7-shade
  // ramp and every surface, border and glow from --brand, and the palette
  // classes simply re-point --brand at the chosen colour.
  const customStyle = {
    "--custom-colour": settings.customColour,
  } as CSSProperties;

  // Broadcast Handlers
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle.trim() || !bcText.trim()) return;
    setIsPublishingBc(true);
    try {
      const res = await adminFetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bcTitle.trim(),
          text: bcText.trim(),
          tag: bcTag,
          imageUrl: bcImageUrl.trim(),
          authorName: "Mr Sad · Admin",
          isPinned: bcPinned,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements((prev) => [data.announcement, ...prev]);
        setBcTitle("");
        setBcText("");
        setBcImageUrl("");
        setBcPinned(false);
        showToast("Official broadcast published to all students!");
      }
    } catch {
      showToast("Error publishing announcement.");
    } finally {
      setIsPublishingBc(false);
    }
  };

  const handleTogglePinAnnouncement = async (item: AnnouncementItem) => {
    const nextPinned = !item.isPinned;
    try {
      const res = await adminFetch("/api/announcements", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          isPinned: nextPinned,
          tag: nextPinned ? "Pinned Announcement" : "Official Broadcast",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === item.id ? data.announcement : a))
        );
        showToast(
          nextPinned ? "Announcement pinned to top!" : "Announcement unpinned."
        );
      }
    } catch {
      showToast("Could not update pin status.");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const res = await adminFetch(`/api/announcements?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
        showToast("Announcement removed.");
      }
    } catch {
      showToast("Failed to delete announcement.");
    }
  };

  // Platform Architect Handlers
  const resetPlatformForm = () => {
    setEditingPlatformId(null);
    setPfName("");
    setPfSubtitle("");
    setPfMetaText("Free Access · Live & Recorded");
    setPfCategory("boards");
    setPfHref("");
    setPfIsModal(false);
    setPfImgSrc("");
    setPfObjectFit("cover");
    setPfTiltAngle(-9);
    setPfAccentShade("var(--ultra-600)");
  };

  const startEditPlatform = (item: PlatformItem) => {
    setEditingPlatformId(item.id);
    setPfName(item.name);
    setPfSubtitle(item.subtitle);
    setPfMetaText(item.metaText);
    setPfCategory(item.category);
    setPfHref(item.href || "");
    setPfIsModal(Boolean(item.isModal));
    setPfImgSrc(item.imgSrc);
    setPfObjectFit(item.objectFit);
    setPfTiltAngle(item.tiltAngle);
    setPfAccentShade(item.accentShade || "#2E5DE6");
  };

  const handleSavePlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfName.trim() || !pfSubtitle.trim()) return;
    setIsSavingPlatform(true);

    const resolvedLogo =
      pfImgSrc.trim() || generateCustomPlatformSvg(pfName, pfAccentShade);

    try {
      const method = editingPlatformId ? "PUT" : "POST";
      const res = await adminFetch("/api/platforms", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPlatformId,
          name: pfName.trim(),
          subtitle: pfSubtitle.trim(),
          metaText: pfMetaText.trim() || "Free Access · Live & Recorded",
          category: pfCategory,
          href: pfHref.trim(),
          isModal: pfIsModal,
          title: `${pfName.trim()} - MIND SPARK`,
          imgSrc: resolvedLogo,
          imgAlt: `${pfName.trim()} Logo`,
          objectFit: pfObjectFit,
          tiltAngle: pfTiltAngle,
          accentShade: pfAccentShade,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (editingPlatformId) {
          setPlatformsList((prev) =>
            prev.map((p) => (p.id === editingPlatformId ? data.platform : p))
          );
          showToast(`Updated "${data.platform.name}" platform!`);
        } else {
          setPlatformsList((prev) => [...prev, data.platform]);
          showToast(`Added "${data.platform.name}" to MIND SPARK ecosystem!`);
        }
        resetPlatformForm();
      }
    } catch {
      showToast("Failed to save platform.");
    } finally {
      setIsSavingPlatform(false);
    }
  };

  const handleDeletePlatform = async (id: number, name: string) => {
    try {
      const res = await adminFetch(`/api/platforms?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlatformsList((prev) => prev.filter((p) => p.id !== id));
        if (editingPlatformId === id) resetPlatformForm();
        showToast(`Removed "${name}" platform.`);
      }
    } catch {
      showToast("Failed to remove platform.");
    }
  };

  const handleResetDefaultPlatforms = async () => {
    try {
      const res = await adminFetch("/api/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (res.ok) {
        const data = await res.json();
        setPlatformsList(data.platforms || []);
        resetPlatformForm();
        showToast("Restored all 8 default MIND SPARK platforms!");
      }
    } catch {
      showToast("Failed to reset platforms.");
    }
  };

  // Appearance & Settings Handlers
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    []
  );

  const persistSettings = async (
    nextSettings: SiteSettingsData,
    announce = true
  ) => {
    setIsSavingSettings(true);
    try {
      const res = await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
        if (announce) showToast("Global colour palette & style saved!");
      } else if (announce) {
        showToast("Failed to save settings.");
      }
    } catch {
      if (announce) showToast("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  /** Discrete changes (palette mode, card style): apply and save immediately. */
  const handleSaveSettings = (nextSettings: SiteSettingsData) => {
    setSettings(nextSettings);
    void persistSettings(nextSettings);
  };

  /**
   * Continuous changes (dragging the colour picker): recolour on the very first
   * frame, then debounce the write so dragging does not fire a request per
   * pixel.
   */
  const handleThemeDrag = (nextSettings: SiteSettingsData) => {
    setSettings(nextSettings);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => void persistSettings(nextSettings, false),
      700
    );
  };

  const totalLikesCount = announcements.reduce(
    (sum, a) => sum + (a.likes || 0),
    0
  );

  // Live preview item for Platform Architect
  const livePlatformPreview: PlatformItem = {
    id: editingPlatformId || 999,
    name: pfName.trim() || "New Platform",
    subtitle: pfSubtitle.trim() || "Board & Competitive Prep",
    metaText: pfMetaText.trim() || "Free Access · Live & Recorded",
    category: pfCategory,
    href: pfHref.trim() || "https://mindspark.edu",
    isModal: pfIsModal,
    title: `${pfName.trim() || "New Platform"} - MIND SPARK`,
    imgSrc:
      pfImgSrc.trim() ||
      generateCustomPlatformSvg(
        pfName.trim() || "MIND SPARK",
        pfAccentShade || "#2E5DE6"
      ),
    imgAlt: "Preview Logo",
    objectFit: pfObjectFit,
    tiltAngle: pfTiltAngle,
    accentShade: pfAccentShade,
    delayMs: 0,
  };

  return (
    <div
      className={`site-shell ${
        settings.palette === "red"
          ? "theme-red"
          : settings.palette === "green"
            ? "theme-green"
            : settings.palette === "custom"
              ? "theme-custom"
              : ""
      } min-h-[100dvh] relative flex flex-col lg:flex-row text-ink pb-24 lg:pb-8 overflow-x-hidden`}
      style={customStyle}
    >
      {/* Ambient Ultramarine Glow Orbs */}
      <div
        aria-hidden="true"
        className="ambient-glow fixed top-[-12%] left-1/2 -translate-x-1/2 w-[420px] sm:w-[760px] h-[340px] rounded-full blur-[130px] pointer-events-none z-0"
        style={{ background: "color-mix(in srgb, var(--ultra-600) 32%, transparent)" }}
      />
      <div
        aria-hidden="true"
        className="ambient-glow fixed bottom-[-15%] left-1/4 w-[320px] sm:w-[520px] h-[320px] rounded-full blur-[140px] pointer-events-none z-0"
        style={{ background: "color-mix(in srgb, var(--ultra-400) 18%, transparent)" }}
      />

      {/* Toast Feedback Banner */}
      {toastMessage && (
        <div
          className="fixed top-4 right-4 z-[90] flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs sm:text-sm font-display font-bold text-ink animate-pop-in"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--ultra-600) 95%, transparent) 0%, color-mix(in srgb, var(--ultra-900) 98%, transparent) 100%)",
            border: "1.5px solid color-mix(in srgb, var(--ultra-50) 65%, transparent)",
            boxShadow: "0 16px 35px color-mix(in srgb, var(--ultra-950) 85%, transparent)",
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-ink shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ============================================================
          DESKTOP LEFT 3D GLASS COMMAND SIDEBAR
      ============================================================ */}
      <aside
        className="hidden lg:flex flex-col w-72 shrink-0 m-4 rounded-[28px] p-5 relative z-20 justify-between self-start sticky top-4 min-h-[calc(100dvh-2rem)]"
        style={{
          background:
            "linear-gradient(165deg, color-mix(in srgb, var(--ultra-200) 18%, transparent) 0%, color-mix(in srgb, var(--ultra-800) 34%, transparent) 45%, color-mix(in srgb, var(--ultra-950) 88%, transparent) 100%)",
          backdropFilter: "var(--glass-filter)",
          borderTop: "1.5px solid color-mix(in srgb, var(--ultra-50) 55%, transparent)",
          borderLeft: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
          borderRight: "1px solid color-mix(in srgb, var(--ultra-200) 25%, transparent)",
          borderBottom: "1.5px solid color-mix(in srgb, var(--ultra-950) 85%, transparent)",
          boxShadow:
            "0 20px 50px -12px color-mix(in srgb, var(--ultra-950) 85%, transparent), inset 0 1.5px 2px color-mix(in srgb, var(--ultra-50) 40%, transparent)",
        }}
      >
        <div className="space-y-6">
          {/* Brand Identity */}
          <div className="flex items-center gap-3 pb-4 border-b border-mist/20">
            <GlassShieldIcon className="w-11 h-11 shrink-0" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-mist">
                  Command Studio
                </span>
                <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
              </div>
              <h1 className="font-display font-extrabold text-lg tracking-tight text-ink">
                MIND SPARK
              </h1>
              <p className="text-[11px] text-mist">Super Admin · Google verified</p>
            </div>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-2" aria-label="Admin Modules">
            {[
              {
                id: "broadcasts" as const,
                label: "Broadcast Studio",
                sub: "Send Announcements",
                icon: BellRing,
                badge: announcements.length,
              },
              {
                id: "inbox" as const,
                label: "Visitor Chats",
                sub: "WhatsApp-style DMs",
                icon: Inbox,
                badge: chatUnread,
                highlightBadge: chatUnread > 0,
              },
              {
                id: "platforms" as const,
                label: "Platform Architect",
                sub: "Add / Remove Folders",
                icon: Layers,
                badge: platformsList.length,
              },
              {
                id: "appearance" as const,
                label: "Colour & Style",
                sub: "Palette & Card Theme",
                icon: Palette,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-2xl text-left transition-ui cursor-pointer ${
                    active
                      ? "text-ink scale-[1.01]"
                      : "text-mist hover:text-ink hover:bg-white/5"
                  }`}
                  style={
                    active
                      ? {
                          background:
                            "linear-gradient(135deg, color-mix(in srgb, var(--ultra-600) 85%, transparent) 0%, color-mix(in srgb, var(--ultra-400) 55%, transparent) 100%)",
                          border: "1px solid color-mix(in srgb, var(--ultra-50) 60%, transparent)",
                          boxShadow: "0 10px 24px -6px color-mix(in srgb, var(--ultra-600) 60%, transparent)",
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: active
                          ? "color-mix(in srgb, var(--ultra-950) 45%, transparent)"
                          : "color-mix(in srgb, var(--ultra-900) 55%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--ultra-50) 30%, transparent)",
                      }}
                    >
                      <Icon className="w-4 h-4 text-ink" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-bold text-sm leading-tight truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-mist/85 truncate mt-0.5">
                        {item.sub}
                      </p>
                    </div>
                  </div>

                  {typeof item.badge === "number" && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                        item.highlightBadge
                          ? "bg-ink text-abyss"
                          : "bg-abyss/55 text-ink"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="space-y-2.5 pt-4 border-t border-mist/20">
          {adminEmail && (
            <p className="px-1 text-[11px] leading-relaxed text-mist break-all">
              Signed in as
              <br />
              <span className="font-display font-bold text-ink">{adminEmail}</span>
            </p>
          )}

          <a
            href={PUBLIC_SITE_URL}
            target="_blank"
            rel="noreferrer"
            className="w-full py-3 px-4 rounded-2xl font-display font-bold text-xs text-ink flex items-center justify-center gap-2 transition-ui hover:-translate-y-0.5 cursor-pointer"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--ultra-200) 28%, transparent) 0%, color-mix(in srgb, var(--ultra-600) 45%, transparent) 100%)",
              border: "1px solid color-mix(in srgb, var(--ultra-50) 50%, transparent)",
            }}
          >
            <Eye className="w-4 h-4" />
            <span>View Live Student Website</span>
          </a>

          <button
            type="button"
            onClick={() => onSignOut?.()}
            className="w-full py-2.5 px-4 rounded-2xl font-display font-semibold text-xs text-mist hover:text-ink hover:bg-white/10 flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ============================================================
          MAIN WORKSPACE AREA
      ============================================================ */}
      <div className="flex-1 min-w-0 px-4 sm:px-6 pt-4 lg:pt-5 relative z-10 max-w-6xl mx-auto w-full">
        {/* Top Mobile & Desktop Glass Header */}
        <header
          className="rounded-[24px] p-4 sm:p-5 mb-6 flex flex-wrap items-center justify-between gap-3"
          style={{
            background:
              "linear-gradient(145deg, color-mix(in srgb, var(--ultra-200) 22%, transparent) 0%, color-mix(in srgb, var(--ultra-800) 38%, transparent) 55%, color-mix(in srgb, var(--ultra-900) 82%, transparent) 100%)",
            backdropFilter: "var(--glass-filter)",
            borderTop: "1.5px solid color-mix(in srgb, var(--ultra-50) 58%, transparent)",
            borderLeft: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
            borderRight: "1px solid color-mix(in srgb, var(--ultra-200) 25%, transparent)",
            borderBottom: "1.5px solid color-mix(in srgb, var(--ultra-950) 85%, transparent)",
            boxShadow: "0 16px 36px -10px color-mix(in srgb, var(--ultra-950) 80%, transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <GlassEnvelopeNotificationIcon
              className="w-11 h-11 shrink-0"
              hasUnread={chatUnread > 0}
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-mist">
                  MIND SPARK ECOSYSTEM
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-accent/55 border border-ink/40">
                  Admin Live
                </span>
              </div>
              <h2 className="font-display font-extrabold text-lg sm:text-2xl text-ink tracking-tight">
                {activeSection === "broadcasts" &&
                  "Announcement Broadcast Studio"}
                {activeSection === "inbox" &&
                  "Google-Verified Student Direct Inbox"}
                {activeSection === "platforms" &&
                  "3D Folder Platform Architect"}
                {activeSection === "appearance" &&
                  "Colour Palette & Glass Style Studio"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAllAdminData}
              aria-label="Refresh Dashboard Data"
              className="p-2.5 rounded-2xl text-ink hover:bg-white/10 border border-mist/35 cursor-pointer"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingData ? "animate-spin" : ""}`}
              />
            </button>

            <a
              href={PUBLIC_SITE_URL}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-2.5 rounded-2xl font-display font-bold text-xs text-ink flex items-center gap-1.5 cursor-pointer"
              style={{
                background:
                  "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
                border: "1px solid color-mix(in srgb, var(--ultra-50) 55%, transparent)",
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Live Website</span>
            </a>

            <button
              type="button"
              onClick={() => onSignOut?.()}
              aria-label="Sign out"
              className="lg:hidden p-2.5 rounded-2xl text-mist hover:text-white border border-mist/30 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>


        {/* ============================================================
            MODULE 1: ANNOUNCEMENT BROADCASTER
        ============================================================ */}
        {activeSection === "broadcasts" && (
          <div className="space-y-6 animate-pop-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Announcement Composer */}
              <form
                onSubmit={handlePublishAnnouncement}
                className="lg:col-span-7 rounded-[26px] p-5 sm:p-6 space-y-4"
                style={{
                  background:
                    "linear-gradient(160deg, color-mix(in srgb, var(--ultra-200) 22%, transparent) 0%, color-mix(in srgb, var(--ultra-800) 34%, transparent) 45%, color-mix(in srgb, var(--ultra-900) 82%, transparent) 100%)",
                  borderTop: "1.5px solid color-mix(in srgb, var(--ultra-50) 58%, transparent)",
                  borderLeft: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
                  borderRight: "1px solid color-mix(in srgb, var(--ultra-200) 25%, transparent)",
                  borderBottom: "1.5px solid color-mix(in srgb, var(--ultra-950) 85%, transparent)",
                  boxShadow: "0 18px 40px -10px color-mix(in srgb, var(--ultra-950) 85%, transparent)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-mist">
                      Mr Sad · Broadcast Transmitter
                    </span>
                    <h3 className="font-display font-bold text-lg text-ink">
                      Send New Announcement to Website
                    </h3>
                  </div>
                  <Sparkles className="w-5 h-5 text-glow" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1.5">
                      Announcement Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={bcTitle}
                      onChange={(e) => setBcTitle(e.target.value)}
                      placeholder="e.g. New Physics Wallah Server 3 Live!"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1.5">
                      Broadcast Badge Tag
                    </label>
                    <select
                      value={bcTag}
                      onChange={(e) => setBcTag(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    >
                      <option value="Official Broadcast">
                        Official Broadcast
                      </option>
                      <option value="Pinned Announcement">
                        Pinned Announcement
                      </option>
                      <option value="Platform Release">Platform Release</option>
                      <option value="Batch Alert">Batch Alert</option>
                      <option value="Exam Notice">Exam Notice</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-mist mb-1.5">
                    Announcement Message *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={bcText}
                    onChange={(e) => setBcText(e.target.value)}
                    placeholder="Write your announcement for MIND SPARK students..."
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1.5">
                      Attachment Image URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={bcImageUrl}
                      onChange={(e) => setBcImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full px-3.5 py-2 rounded-xl text-xs text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer pt-4 sm:pt-5">
                    <input
                      type="checkbox"
                      checked={bcPinned}
                      onChange={(e) => setBcPinned(e.target.checked)}
                      className="w-4 h-4 rounded accent-[var(--ultra-600)]"
                    />
                    <span className="text-xs font-semibold text-ink">
                      Pin to top of Student Notification Drawer
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isPublishingBc}
                  className="w-full py-3.5 px-5 rounded-2xl font-display font-bold text-sm text-ink flex items-center justify-center gap-2 transition-ui hover:-translate-y-0.5 cursor-pointer"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
                    border: "1px solid color-mix(in srgb, var(--ultra-50) 65%, transparent)",
                    boxShadow: "0 10px 25px color-mix(in srgb, var(--ultra-600) 55%, transparent)",
                  }}
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {isPublishingBc
                      ? "Broadcasting to Students..."
                      : "Publish Announcement Now"}
                  </span>
                </button>
              </form>

              {/* Right 5 Cols: Real-Time Dual-Layer Glass Card Preview */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-widest text-mist mb-3 px-1">
                  Live Student Drawer Card Preview
                </p>

                <div className="relative pt-2.5 group">
                  <div
                    className="pointer-events-none absolute top-0 left-3 right-6 h-10 rounded-t-2xl"
                    style={{
                      transform: "rotate(-1.2deg)",
                      background:
                        "linear-gradient(90deg, var(--ultra-600) 0%, var(--ultra-400) 55%, var(--ultra-800) 100%)",
                      boxShadow: "0 4px 16px color-mix(in srgb, var(--ultra-600) 45%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--ultra-50) 45%, transparent)",
                    }}
                  />

                  <div
                    className="relative z-10 rounded-[22px] p-5 overflow-hidden"
                    style={{
                      background: "var(--notification-card-background)",
                      backdropFilter: "var(--glass-soft-filter)",
                      borderTop: "1.5px solid color-mix(in srgb, var(--ultra-50) 55%, transparent)",
                      borderLeft: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
                      borderRight: "1px solid color-mix(in srgb, var(--ultra-200) 25%, transparent)",
                      borderBottom: "1.5px solid color-mix(in srgb, var(--ultra-950) 80%, transparent)",
                      boxShadow:
                        "0 14px 30px -8px color-mix(in srgb, var(--ultra-950) 70%, transparent), inset 0 1.5px 2px color-mix(in srgb, var(--ultra-50) 35%, transparent)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-display font-bold text-xs text-ink"
                          style={{
                            background:
                              "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-800) 100%)",
                            border: "1px solid color-mix(in srgb, var(--ultra-50) 50%, transparent)",
                          }}
                        >
                          MS
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-mist font-bold text-xs tracking-wider uppercase">
                              Mr Sad · Admin
                            </span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-glow" />
                          </div>
                          <span className="block text-[10px] text-mist">
                            Just now · Live Preview
                          </span>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/55 border border-ink/40 text-ink">
                        {bcTag}
                      </span>
                    </div>

                    <h4 className="text-ink font-display font-bold text-[15px] mb-1.5 leading-snug">
                      {bcTitle.trim() ||
                        "Your Announcement Title Appears Here"}
                    </h4>

                    <p className="text-ink/85 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                      {bcText.trim() ||
                        "As you type your message, this 3D dual-layer glassmorphic card previews exactly how students will see your broadcast inside the MIND SPARK Updates drawer."}
                    </p>

                    {bcImageUrl.trim() && (
                      <img
                        src={bcImageUrl.trim()}
                        alt="Preview attachment"
                        className="mt-3 w-full max-h-40 object-cover rounded-xl border border-white/20"
                      />
                    )}

                    <div className="mt-4 pt-3 flex items-center justify-between border-t border-mist/20">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-deep/60 border border-mist/30 text-mist">
                        <Heart className="w-3.5 h-3.5" />0 Likes
                      </span>
                      <span className="text-[11px] font-medium text-mist/75">
                        MIND SPARK Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Broadcasts History */}
            <div className="space-y-3.5">
              <h3 className="font-display font-bold text-base sm:text-lg text-ink px-1">
                Published Broadcasts ({announcements.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {announcements.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[22px] p-4 sm:p-5 flex flex-col justify-between gap-3"
                    style={{
                      background:
                        "linear-gradient(155deg, color-mix(in srgb, var(--ultra-200) 18%, transparent) 0%, color-mix(in srgb, var(--ultra-900) 75%, transparent) 100%)",
                      border: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
                      boxShadow: "0 12px 28px -8px color-mix(in srgb, var(--ultra-950) 70%, transparent)",
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/45 border border-mist/40 text-ink">
                          {item.isPinned && <Pin className="w-2.5 h-2.5" />}
                          {item.tag || "Official Broadcast"}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTogglePinAnnouncement(item)}
                            title={item.isPinned ? "Unpin" : "Pin to top"}
                            className={`p-1.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                              item.isPinned
                                ? "bg-accent text-white border-white/50"
                                : "bg-abyss/50 text-mist border-mist/25 hover:text-white"
                            }`}
                          >
                            <Pin className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAnnouncement(item.id)}
                            title="Delete Announcement"
                            className="p-1.5 rounded-xl bg-[#EF4444]/20 hover:bg-[#EF4444]/40 text-[#FCA5A5] border border-[#EF4444]/35 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h4 className="font-display font-bold text-base text-ink mb-1">
                        {item.title}
                      </h4>
                      <p className="text-xs sm:text-[13px] text-ink/85 leading-relaxed whitespace-pre-wrap">
                        {item.text}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-mist/20 flex items-center justify-between text-xs text-mist">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                        <Heart className="w-3.5 h-3.5 fill-glow text-glow" />
                        {item.likes || 0} Student Likes
                      </span>
                      <span>
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            MODULE 2: WHATSAPP-STYLE CHAT WITH GOOGLE-SIGNED-IN VISITORS
            Kept mounted (hidden) so unread badges stay live from any section.
        ============================================================ */}
        <div className={activeSection === "inbox" ? "block" : "hidden"}>
          <AdminChat
            isActive={activeSection === "inbox"}
            onUnreadChange={setChatUnread}
          />
        </div>

        {/* ============================================================
            MODULE 3: PLATFORM ARCHITECT (ADD / EDIT / REMOVE PLATFORMS)
        ============================================================ */}
        {activeSection === "platforms" && (
          <div className="space-y-6 animate-pop-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Add / Edit Platform Form */}
              <form
                onSubmit={handleSavePlatform}
                className="lg:col-span-7 rounded-[26px] p-5 sm:p-6 space-y-4"
                style={{
                  background:
                    "linear-gradient(160deg, color-mix(in srgb, var(--ultra-200) 22%, transparent) 0%, color-mix(in srgb, var(--ultra-800) 34%, transparent) 45%, color-mix(in srgb, var(--ultra-900) 82%, transparent) 100%)",
                  borderTop: "1.5px solid color-mix(in srgb, var(--ultra-50) 58%, transparent)",
                  borderLeft: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
                  borderRight: "1px solid color-mix(in srgb, var(--ultra-200) 25%, transparent)",
                  borderBottom: "1.5px solid color-mix(in srgb, var(--ultra-950) 85%, transparent)",
                  boxShadow: "0 18px 40px -10px color-mix(in srgb, var(--ultra-950) 85%, transparent)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-mist">
                      Git Repo PlatformItem Schema
                    </span>
                    <h3 className="font-display font-bold text-lg text-ink">
                      {editingPlatformId
                        ? `Editing Platform #${editingPlatformId}`
                        : "Add New Platform Folder to Website"}
                    </h3>
                  </div>
                  {editingPlatformId && (
                    <button
                      type="button"
                      onClick={resetPlatformForm}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-ink cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Platform Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={pfName}
                      onChange={(e) => setPfName(e.target.value)}
                      placeholder="e.g. Apni Kaksha / Allen Digital"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Subtitle (Inside Folder Pocket) *
                    </label>
                    <input
                      type="text"
                      required
                      value={pfSubtitle}
                      onChange={(e) => setPfSubtitle(e.target.value)}
                      placeholder="e.g. Complete JEE & Board Batches"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Bottom Meta Text (`metaText`)
                    </label>
                    <input
                      type="text"
                      value={pfMetaText}
                      onChange={(e) => setPfMetaText(e.target.value)}
                      placeholder="Free Access · Live & Recorded"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Category (`boards` | `jee-neet` | `tools`)
                    </label>
                    <select
                      value={pfCategory}
                      onChange={(e) =>
                        setPfCategory(
                          e.target.value as "boards" | "jee-neet" | "tools"
                        )
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    >
                      <option value="boards">Boards & Foundation</option>
                      <option value="jee-neet">JEE / NEET Competitive</option>
                      <option value="tools">Study Tools & Players</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Target URL (`href`)
                    </label>
                    <input
                      type="url"
                      value={pfHref}
                      onChange={(e) => setPfHref(e.target.value)}
                      placeholder="https://example.vercel.app/"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Preset Logo or Custom Image URL
                    </label>
                    <select
                      value={
                        PRESET_PLATFORM_LOGOS.some((l) => l.value === pfImgSrc)
                          ? pfImgSrc
                          : ""
                      }
                      onChange={(e) => setPfImgSrc(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                    >
                      <option value="">
                        Auto-Generate 3D Ultramarine Emblem (Or Paste URL Below)
                      </option>
                      {PRESET_PLATFORM_LOGOS.map((logo) => (
                        <option key={logo.label} value={logo.value}>
                          {logo.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-mist mb-1">
                    Custom Logo Image URL (Leave blank for auto-generated 3D SVG
                    emblem)
                  </label>
                  <input
                    type="text"
                    value={pfImgSrc}
                    onChange={(e) => setPfImgSrc(e.target.value)}
                    placeholder="https://... or /platforms/next-toppers.webp"
                    className="w-full px-3.5 py-2 rounded-xl text-xs text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
                  />
                </div>

                {/* Tilt Angle, Object Fit & Accent Shade Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Logo Tilt Angle: <strong className="text-white">{pfTiltAngle}°</strong>
                    </label>
                    <input
                      type="range"
                      min={-16}
                      max={16}
                      value={pfTiltAngle}
                      onChange={(e) => setPfTiltAngle(Number(e.target.value))}
                      className="w-full accent-[var(--ultra-400)] cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Logo Fit (`objectFit`)
                    </label>
                    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-abyss/75 border border-mist/30">
                      {(["cover", "contain"] as const).map((fit) => (
                        <button
                          key={fit}
                          type="button"
                          onClick={() => setPfObjectFit(fit)}
                          className={`py-1 rounded-lg text-xs font-bold capitalize cursor-pointer ${
                            pfObjectFit === fit
                              ? "bg-accent text-white"
                              : "text-mist"
                          }`}
                        >
                          {fit}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-mist mb-1">
                      Accent Shade
                    </label>
                    <div className="flex items-center gap-1.5 pt-1">
                      {[
                        "var(--ultra-600)",
                        "var(--ultra-400)",
                        "var(--ultra-800)",
                        "#a855f7",
                        "#ed49bb",
                        "#06b5ab",
                      ].map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => setPfAccentShade(hex)}
                          className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                            pfAccentShade === hex
                              ? "border-white scale-110"
                              : "border-white/30"
                          }`}
                          style={{ backgroundColor: hex }}
                          aria-label={`Select accent color ${hex}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={pfIsModal}
                    onChange={(e) => setPfIsModal(e.target.checked)}
                    className="w-4 h-4 rounded accent-[var(--ultra-600)]"
                  />
                  <span className="text-xs font-semibold text-ink">
                    Open Multi-Server Selection Modal on Click (like Physics
                    Wallah Server 1 / Server 2)
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isSavingPlatform}
                  className="w-full py-3.5 px-5 rounded-2xl font-display font-bold text-sm text-ink flex items-center justify-center gap-2 transition-ui hover:-translate-y-0.5 cursor-pointer"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
                    border: "1px solid color-mix(in srgb, var(--ultra-50) 65%, transparent)",
                    boxShadow: "0 10px 25px color-mix(in srgb, var(--ultra-600) 55%, transparent)",
                  }}
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>
                    {isSavingPlatform
                      ? "Saving Platform..."
                      : editingPlatformId
                        ? "Save Platform Changes"
                        : "Add Platform to Website"}
                  </span>
                </button>
              </form>

              {/* Right 5 Cols: Real-Time 3D Folder & Neon Card Preview */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className="w-full flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-mist">
                    Live 3D Card Preview
                  </span>
                  <div className="flex gap-1 p-1 rounded-full bg-abyss/70 border border-mist/30">
                    {(["folder", "card"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setPreviewMode(st)}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer ${
                          previewMode === st
                            ? "bg-glow text-abyss"
                            : "text-ink"
                        }`}
                      >
                        {st === "folder" ? "3D Folder" : "Neon Card"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-full max-w-[260px] mx-auto py-4">
                  {previewMode === "folder" ? (
                    <PlatformFolderCard item={livePlatformPreview} priority />
                  ) : (
                    <PlatformNeonCard item={livePlatformPreview} priority />
                  )}
                </div>
              </div>
            </div>

            {/* Active Platforms Management Grid */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <h3 className="font-display font-bold text-base sm:text-lg text-ink">
                  Active Website Platforms ({platformsList.length})
                </h3>
                <button
                  type="button"
                  onClick={handleResetDefaultPlatforms}
                  className="px-3.5 py-2 rounded-xl text-xs font-display font-bold text-mist hover:text-white bg-abyss/60 border border-mist/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore Default 8 Platforms</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {platformsList.map((pf) => (
                  <div
                    key={pf.id}
                    className="rounded-[24px] p-3.5 flex flex-col justify-between gap-3"
                    style={{
                      background: "color-mix(in srgb, var(--ultra-900) 55%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--ultra-200) 32%, transparent)",
                    }}
                  >
                    <PlatformFolderCard item={pf} />

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startEditPlatform(pf)}
                        className="flex-1 py-2 px-3 rounded-xl font-display font-bold text-xs text-ink bg-accent/50 hover:bg-accent border border-mist/40 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePlatform(pf.id, pf.name)}
                        className="py-2 px-3 rounded-xl font-display font-bold text-xs text-[#FCA5A5] bg-[#EF4444]/20 hover:bg-[#EF4444]/40 border border-[#EF4444]/35 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================
            MODULE 4: COLOUR PALETTE & GLASS STYLE STUDIO
        ============================================================ */}
        {activeSection === "appearance" && (
          <div className="space-y-6 animate-pop-in">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Colour Palette & Custom Hex Picker */}
              <div
                className="lg:col-span-7 rounded-[26px] p-5 sm:p-6 space-y-5"
                style={{
                  background:
                    "linear-gradient(160deg, color-mix(in srgb, var(--ultra-200) 22%, transparent) 0%, color-mix(in srgb, var(--ultra-800) 34%, transparent) 45%, color-mix(in srgb, var(--ultra-900) 82%, transparent) 100%)",
                  borderTop: "1.5px solid color-mix(in srgb, var(--ultra-50) 58%, transparent)",
                  borderLeft: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
                  borderRight: "1px solid color-mix(in srgb, var(--ultra-200) 25%, transparent)",
                  borderBottom: "1.5px solid color-mix(in srgb, var(--ultra-950) 85%, transparent)",
                }}
              >
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-mist">
                    Global Appearance Engine
                  </span>
                  <h3 className="font-display font-bold text-lg text-ink">
                    Choose Website Colour Palette & Card Style
                  </h3>
                  <p className="text-xs text-mist mt-1">
                    Select the default colour palette for MIND SPARK. Changes
                    apply immediately across the glassmorphic folders, ambient
                    glows, and notification drawer.
                  </p>
                </div>

                {/* Primary 4 Palette Modes */}
                <div className="palette-switch space-y-2.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-mist">
                    1. Primary Colour Palette
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(
                      [
                        {
                          id: "blue",
                          label: "Ultramarine",
                          swatch: "var(--ultra-600)",
                        },
                        { id: "red", label: "Crimson Red", swatch: "#d00018" },
                        {
                          id: "green",
                          label: "Avocado Lime",
                          swatch: "#98BF0A",
                        },
                        {
                          id: "custom",
                          label: "Custom Colour",
                          swatch: settings.customColour,
                        },
                      ] as const
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() =>
                          handleSaveSettings({ ...settings, palette: mode.id })
                        }
                        className={`p-3.5 rounded-2xl font-display font-bold text-xs flex flex-col items-center gap-2 transition-ui cursor-pointer border ${
                          settings.palette === mode.id
                            ? "bg-white text-abyss border-white shadow-lg scale-[1.02]"
                            : "bg-abyss/65 text-ink border-mist/30 hover:bg-white/10"
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-full border-2 border-white/60 shadow-inner"
                          style={{ backgroundColor: mode.swatch }}
                        />
                        <span>{mode.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Colour Swatches + Any Hex Picker */}
                <div className="palette-switch p-4 rounded-2xl bg-abyss/60 border border-mist/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-ink">
                      2. Choose Custom Colour Swatch
                    </label>
                    <span className="text-xs font-mono text-mist">
                      {settings.customColour}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {CUSTOM_COLOURS.map((colour) => (
                      <button
                        key={colour.value}
                        type="button"
                        onClick={() =>
                          handleSaveSettings({
                            ...settings,
                            palette: "custom",
                            customColour: colour.value,
                          })
                        }
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl text-[11px] font-semibold cursor-pointer border ${
                          settings.customColour.toLowerCase() ===
                            colour.value && settings.palette === "custom"
                            ? "bg-white/20 border-white text-white"
                            : "border-white/15 text-mist hover:bg-white/10"
                        }`}
                      >
                        <span
                          className="w-7 h-7 rounded-full border-2 border-white/50"
                          style={{ backgroundColor: colour.value }}
                        />
                        <span>{colour.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <label className="text-xs font-semibold text-mist">
                      Or pick any custom hex colour:
                    </label>
                    <input
                      type="color"
                      value={settings.customColour}
                      onChange={(e) =>
                        handleThemeDrag({
                          ...settings,
                          palette: "custom",
                          customColour: e.target.value,
                        })
                      }
                      className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border border-white/30"
                    />
                  </div>
                </div>

                {/* Platform Card Layout Style */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-mist">
                    3. Default Platform Layout Architecture
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(["folder", "card"] as const).map((style) => (
                      <button
                        key={style}
                        type="button"
                        onClick={() =>
                          handleSaveSettings({ ...settings, cardStyle: style })
                        }
                        className={`py-3 px-4 rounded-2xl font-display font-bold text-xs sm:text-sm cursor-pointer border transition-ui ${
                          settings.cardStyle === style
                            ? "bg-glow text-abyss border-white shadow-lg"
                            : "bg-abyss/60 text-ink border-mist/30 hover:bg-white/10"
                        }`}
                      >
                        {style === "folder"
                          ? "3D Glass Folders (Default)"
                          : "Glowing Neon Cards"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Student Style Override Toggle */}
                <label className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-abyss/55 border border-mist/25 cursor-pointer">
                  <div>
                    <p className="font-display font-bold text-xs sm:text-sm text-ink">
                      Allow Students to Customise Style Locally
                    </p>
                    <p className="text-[11px] text-mist">
                      When enabled, students see the top-left &ldquo;Your
                      Style&rdquo; button on the landing page.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.allowUserThemeOverride}
                    onChange={(e) =>
                      handleSaveSettings({
                        ...settings,
                        allowUserThemeOverride: e.target.checked,
                      })
                    }
                    className="w-5 h-5 accent-[var(--ultra-600)]"
                  />
                </label>
              </div>

              {/* Right 5 Cols: 7-Shade Ultramarine Reference & Admin Security */}
              <div className="lg:col-span-5 space-y-5">
                <div
                  className="rounded-[26px] p-5 space-y-3.5"
                  style={{
                    background: "color-mix(in srgb, var(--ultra-900) 60%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
                  }}
                >
                  <h4 className="font-display font-bold text-sm uppercase tracking-wider text-mist">
                    7-Shade Ultramarine Palette Architecture
                  </h4>
                  <div className="space-y-2">
                    {ULTRAMARINE_PALETTE.map((shade) => (
                      <div
                        key={shade.hex}
                        className="flex items-center justify-between p-2 rounded-xl bg-abyss/55 border border-white/10"
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-6 h-6 rounded-lg border border-white/40 shrink-0"
                            style={{ backgroundColor: shade.hex }}
                          />
                          <div>
                            <p className="font-display font-bold text-xs text-ink">
                              {shade.name}
                            </p>
                            <p className="text-[10px] text-mist">
                              {shade.role}
                            </p>
                          </div>
                        </div>
                        <code className="text-xs font-mono text-mist">
                          {shade.hex}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Administrator access */}
                <div
                  className="rounded-[26px] p-5 space-y-3"
                  style={{
                    background: "color-mix(in srgb, var(--ultra-900) 60%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
                  }}
                >
                  <h4 className="font-display font-bold text-sm text-ink flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-glow" />
                    <span>Administrator Access</span>
                  </h4>
                  <p className="text-[11px] leading-relaxed text-mist">
                    Passcode sign-in has been removed. Administrators sign in with Google and are
                    checked against the allowlist table{" "}
                    <code className="font-mono text-ink">public.mindspark_admins</code> in
                    Supabase on every request.
                  </p>
                  <p className="text-[11px] text-mist break-all">
                    Current session:{" "}
                    <span className="font-display font-bold text-ink">
                      {adminEmail || "unknown"}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          MOBILE BOTTOM 3D GLASS NAVIGATION DOCK
      ============================================================ */}
      <nav
        aria-label="Mobile Admin Navigation"
        className="lg:hidden fixed bottom-3 inset-x-3 z-50 rounded-[24px] p-1.5 grid grid-cols-4 gap-1"
        style={{
          background:
            "linear-gradient(155deg, color-mix(in srgb, var(--ultra-800) 95%, transparent) 0%, color-mix(in srgb, var(--ultra-950) 98%, transparent) 100%)",
          backdropFilter: "var(--glass-filter)",
          border: "1.5px solid color-mix(in srgb, var(--ultra-50) 48%, transparent)",
          boxShadow: "0 18px 40px color-mix(in srgb, var(--ultra-950) 95%, transparent)",
        }}
      >
        {[
          { id: "broadcasts" as const, label: "Broadcast", icon: BellRing },
          {
            id: "inbox" as const,
            label: "Chats",
            icon: MessageSquare,
            badge: chatUnread,
          },
          { id: "platforms" as const, label: "Platforms", icon: Plus },
          { id: "appearance" as const, label: "Colours", icon: Palette },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSection(tab.id)}
              className={`relative py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 transition-ui cursor-pointer ${
                active
                  ? "bg-accent text-ink shadow-md"
                  : "text-mist"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-display font-bold leading-none">
                {tab.label}
              </span>
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span className="absolute top-1 right-3 w-4 h-4 rounded-full bg-white text-abyss text-[9px] font-extrabold flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
