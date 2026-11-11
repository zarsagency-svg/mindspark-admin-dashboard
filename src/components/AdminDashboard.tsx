"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Heart,
  Image as ImageIcon,
  LogOut,
  Menu,
  MessageCircle,
  Palette,
  Pin,
  Send,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { CUSTOM_COLOURS } from "@/data/platforms";
import type { AnnouncementItem } from "./types";
import { AdminChat, type IncomingBannerAlert } from "./AdminChat";
import { PUBLIC_SITE_URL } from "@/lib/config";
import { adminFetch } from "@/lib/supabase";
import {
  getNotificationPermissionState,
  playMessageNotificationSound,
  requestBrowserNotificationPermission,
  unlockNotificationAudio,
} from "@/lib/notifications";

interface SiteSettingsData {
  palette: "blue" | "red" | "green" | "custom";
  customColour: string;
  cardStyle: "folder" | "card";
  allowUserThemeOverride: boolean;
  telegramChannel: string;
}

interface AdminDashboardProps {
  adminEmail?: string;
  onSignOut?: () => void;
}

type AdminSection = "inbox" | "broadcasts";

const BROADCAST_TAGS = [
  "Official Broadcast",
  "Pinned Announcement",
  "Platform Release",
  "Batch Alert",
  "Exam Notice",
] as const;

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  adminEmail = "",
  onSignOut,
}) => {
  const [activeSection, setActiveSection] = useState<AdminSection>("inbox");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Data states
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [chatUnread, setChatUnread] = useState(0);
  const [settings, setSettings] = useState<SiteSettingsData>({
    palette: "blue",
    customColour: "#a855f7",
    cardStyle: "folder",
    allowUserThemeOverride: true,
    telegramChannel: "https://t.me/zarsstudy",
  });
  const [toastMessage, setToastMessage] = useState("");
  const [incomingBanner, setIncomingBanner] =
    useState<IncomingBannerAlert | null>(null);

  // Notification & Sound state
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifPermission, setNotifPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  // Broadcast Composer State (supports both Create & Edit)
  const [editingBcId, setEditingBcId] = useState<string | null>(null);
  const [bcTitle, setBcTitle] = useState("");
  const [bcText, setBcText] = useState("");
  const [bcTag, setBcTag] = useState<string>("Official Broadcast");
  const [bcImageUrl, setBcImageUrl] = useState("");
  const [bcPinned, setBcPinned] = useState(false);
  const [isPublishingBc, setIsPublishingBc] = useState(false);

  // Settings saving timer
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? "" : prev));
    }, 3500);
  };

  // Unlock browser Web Audio on first user interaction & read notification permission
  useEffect(() => {
    const savedSound = window.localStorage.getItem("ms_sound_enabled");
    if (savedSound === "false") setSoundEnabled(false);
    setNotifPermission(getNotificationPermissionState());

    const unlockOnGesture = () => {
      unlockNotificationAudio();
    };
    window.addEventListener("pointerdown", unlockOnGesture, { passive: true });
    window.addEventListener("keydown", unlockOnGesture, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
    };
  }, []);

  const fetchAllAdminData = async () => {
    try {
      const [annRes, setRes] = await Promise.all([
        adminFetch("/api/announcements"),
        adminFetch("/api/settings"),
      ]);

      if (annRes.ok) {
        const d = await annRes.json();
        setAnnouncements(d.announcements || []);
      }
      if (setRes.ok) {
        const d = await setRes.json();
        if (d.settings) {
          setSettings(d.settings);
        }
      }
    } catch {
      // Silent initial retry handled by modules
    }
  };

  useEffect(() => {
    void fetchAllAdminData();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (bannerTimer.current) clearTimeout(bannerTimer.current);
    };
  }, []);

  const handleEnableBrowserAlerts = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotifPermission(perm);
    setSoundEnabled(true);
    window.localStorage.setItem("ms_sound_enabled", "true");
    if (perm === "granted") {
      showToast("Notification sound & browser alerts enabled!");
    } else {
      showToast("Notification sound enabled!");
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    window.localStorage.setItem("ms_sound_enabled", String(next));
    if (next) {
      unlockNotificationAudio();
      playMessageNotificationSound();
      showToast("Notification sound ON");
    } else {
      showToast("Notification sound muted");
    }
  };

  const handleIncomingAlert = (alert: IncomingBannerAlert) => {
    setIncomingBanner(alert);
    if (bannerTimer.current) clearTimeout(bannerTimer.current);
    bannerTimer.current = setTimeout(() => {
      setIncomingBanner((prev) => (prev?.id === alert.id ? null : prev));
    }, 5500);
  };

  const customStyle = {
    "--custom-colour": settings.customColour,
  } as CSSProperties;

  // Settings persistence
  const persistSettings = async (
    nextSettings: SiteSettingsData,
    announce = true
  ) => {
    try {
      const res = await adminFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
        if (announce) showToast("Theme updated");
      }
    } catch {
      if (announce) showToast("Failed to save theme");
    }
  };

  const handleSaveSettings = (nextSettings: SiteSettingsData) => {
    setSettings(nextSettings);
    void persistSettings(nextSettings);
  };

  const handleThemeDrag = (nextSettings: SiteSettingsData) => {
    setSettings(nextSettings);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(
      () => void persistSettings(nextSettings, false),
      650
    );
  };

  // Broadcast Handlers
  const resetBroadcastForm = () => {
    setEditingBcId(null);
    setBcTitle("");
    setBcText("");
    setBcTag("Official Broadcast");
    setBcImageUrl("");
    setBcPinned(false);
  };

  const startEditAnnouncement = (item: AnnouncementItem) => {
    setEditingBcId(item.id);
    setBcTitle(item.title);
    setBcText(item.text);
    setBcTag(item.tag || "Official Broadcast");
    setBcImageUrl(item.imageUrl || "");
    setBcPinned(Boolean(item.isPinned));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bcTitle.trim() || !bcText.trim()) return;
    setIsPublishingBc(true);
    try {
      if (editingBcId) {
        const res = await adminFetch("/api/announcements", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingBcId,
            title: bcTitle.trim(),
            text: bcText.trim(),
            tag: bcTag,
            imageUrl: bcImageUrl.trim(),
            isPinned: bcPinned,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setAnnouncements((prev) =>
            prev.map((a) => (a.id === editingBcId ? data.announcement : a))
          );
          resetBroadcastForm();
          showToast("Announcement updated!");
        }
      } else {
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
          resetBroadcastForm();
          showToast("Announcement published!");
        }
      }
    } catch {
      showToast("Error saving announcement");
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
        showToast(nextPinned ? "Pinned" : "Unpinned");
      }
    } catch {
      showToast("Could not update pin");
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const res = await adminFetch(
        `/api/announcements?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== id));
        if (editingBcId === id) resetBroadcastForm();
        showToast("Deleted");
      }
    } catch {
      showToast("Failed to delete");
    }
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
      } h-[100dvh] w-screen overflow-hidden relative flex flex-col text-ink`}
      style={customStyle}
    >
      {/* Toast Feedback Pill */}
      {toastMessage && (
        <div
          className="fixed bottom-4 right-4 z-[95] flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-display font-bold text-ink animate-pop-in"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--ultra-600) 95%, transparent) 0%, color-mix(in srgb, var(--ultra-900) 98%, transparent) 100%)",
            border:
              "1px solid color-mix(in srgb, var(--ultra-50) 60%, transparent)",
            boxShadow:
              "0 14px 30px color-mix(in srgb, var(--ultra-950) 85%, transparent)",
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-ink shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Instagram DM Style Top Drop-Down Incoming Message Banner */}
      {incomingBanner && (
        <button
          type="button"
          onClick={() => {
            setActiveSection("inbox");
            setIncomingBanner(null);
          }}
          className="fixed top-3 left-1/2 z-[100] w-[92vw] max-w-sm rounded-2xl px-3.5 py-2.5 flex items-center gap-3 text-left cursor-pointer animate-ig-toast"
          style={{
            background:
              "linear-gradient(145deg, color-mix(in srgb, var(--ultra-800) 96%, black) 0%, color-mix(in srgb, var(--ultra-950) 98%, black) 100%)",
            border:
              "1.5px solid color-mix(in srgb, var(--ultra-400) 75%, transparent)",
            boxShadow:
              "0 20px 45px -10px rgba(0,0,0,0.85), 0 0 25px color-mix(in srgb, var(--ultra-600) 50%, transparent)",
          }}
        >
          <span className="relative shrink-0 p-[2px] rounded-full bg-[linear-gradient(135deg,var(--ultra-400),#ec4899)]">
            {incomingBanner.senderAvatar ? (
              <img
                src={incomingBanner.senderAvatar}
                alt=""
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <span className="w-10 h-10 rounded-full grid place-items-center font-display font-bold text-xs text-ink bg-abyss">
                {incomingBanner.senderInitials}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-display font-extrabold text-xs text-ink">
                {incomingBanner.senderName}
              </span>
              <span className="text-[10px] font-bold text-glow">Now</span>
            </span>
            <span className="block truncate text-xs text-mist mt-0.5">
              {incomingBanner.body}
            </span>
          </span>
        </button>
      )}

      {/* ============================================================
          SLIM TOP BAR (No rectangular header box above the screen)
      ============================================================ */}
      <div className="h-13 shrink-0 px-3 sm:px-4 flex items-center justify-between gap-2 border-b border-mist/15 bg-abyss/75 backdrop-blur-md z-30">
        {/* Left Corner: 3-Line Button + View Switcher */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu and colour settings"
            className="relative p-2 rounded-xl text-ink hover:bg-white/10 border border-mist/25 cursor-pointer transition-colors"
          >
            <Menu className="w-5 h-5" />
            {chatUnread > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-glow border border-abyss" />
            )}
          </button>

          {/* Compact Segmented Switcher: Chat vs Announce */}
          <div className="flex items-center p-0.5 rounded-full bg-abyss/90 border border-mist/25">
            <button
              type="button"
              onClick={() => setActiveSection("inbox")}
              className={`px-3.5 py-1.5 rounded-full font-display font-bold text-xs flex items-center gap-1.5 transition-ui cursor-pointer ${
                activeSection === "inbox"
                  ? "bg-accent text-ink shadow-sm"
                  : "text-mist hover:text-ink"
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Chat</span>
              {chatUnread > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-ink text-abyss">
                  {chatUnread}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("broadcasts")}
              className={`px-3.5 py-1.5 rounded-full font-display font-bold text-xs flex items-center gap-1.5 transition-ui cursor-pointer ${
                activeSection === "broadcasts"
                  ? "bg-accent text-ink shadow-sm"
                  : "text-mist hover:text-ink"
              }`}
            >
              <BellRing className="w-3.5 h-3.5" />
              <span>Announce</span>
            </button>
          </div>
        </div>

        {/* Right Corner: Browser Notification Prompt + Sound Toggle + Live Link */}
        <div className="flex items-center gap-2">
          {notifPermission === "default" && (
            <button
              type="button"
              onClick={() => void handleEnableBrowserAlerts()}
              className="px-3 py-1.5 rounded-full font-display font-bold text-[11px] text-abyss bg-glow hover:opacity-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Bell className="w-3.5 h-3.5 animate-bell-ring" />
              <span className="hidden sm:inline">Enable Alerts</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleSound}
            title={
              soundEnabled
                ? "Notification sound is ON (click to mute)"
                : "Notification sound is OFF (click to enable)"
            }
            aria-label="Toggle notification sound"
            className={`p-2 rounded-full border cursor-pointer transition-colors ${
              soundEnabled
                ? "text-glow border-glow/40 bg-glow/10"
                : "text-mist/60 border-mist/20 hover:text-ink"
            }`}
          >
            {soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          <a
            href={PUBLIC_SITE_URL}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-full font-display font-bold text-xs text-ink flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-[1.02]"
            style={{
              background:
                "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
              border:
                "1px solid color-mix(in srgb, var(--ultra-50) 50%, transparent)",
            }}
          >
            <span>Live</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ============================================================
          LEFT CORNER THREE-LINE DRAWER (Colour Selection & Controls)
      ============================================================ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[80] flex">
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          <aside
            className="relative z-10 w-80 max-w-[86vw] h-full p-5 flex flex-col justify-between overflow-y-auto animate-drawer-left"
            style={{
              background:
                "linear-gradient(165deg, color-mix(in srgb, var(--ultra-800) 92%, black) 0%, color-mix(in srgb, var(--ultra-950) 98%, black) 100%)",
              borderRight:
                "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
              boxShadow: "0 24px 60px rgba(0,0,0,0.85)",
            }}
          >
            <div className="space-y-6">
              {/* Drawer Top Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-mist/15">
                <span className="font-display font-extrabold text-base text-ink tracking-tight">
                  MIND SPARK
                </span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="p-1.5 rounded-xl text-mist hover:text-ink hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Colour Selection Inside 3-Line Menu */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-mist">
                  <Palette className="w-4 h-4 text-glow" />
                  <span>Colour Theme</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: "blue",
                        label: "Ultramarine",
                        swatch: "#2e5de6",
                      },
                      { id: "red", label: "Crimson", swatch: "#d00018" },
                      {
                        id: "green",
                        label: "Lime",
                        swatch: "#98BF0A",
                      },
                      {
                        id: "custom",
                        label: "Custom",
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
                      className={`p-2.5 rounded-xl font-display font-bold text-xs flex items-center gap-2.5 transition-ui cursor-pointer border ${
                        settings.palette === mode.id
                          ? "bg-white text-abyss border-white shadow-md"
                          : "bg-abyss/60 text-ink border-mist/25 hover:bg-white/10"
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-full border border-white/60 shrink-0"
                        style={{ backgroundColor: mode.swatch }}
                      />
                      <span className="truncate">{mode.label}</span>
                    </button>
                  ))}
                </div>

                {/* Custom Swatches + Colour Picker */}
                <div className="p-3 rounded-2xl bg-abyss/55 border border-mist/20 space-y-3">
                  <div className="grid grid-cols-6 gap-1.5">
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
                        title={colour.name}
                        className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform ${
                          settings.customColour.toLowerCase() ===
                            colour.value && settings.palette === "custom"
                            ? "border-white scale-110"
                            : "border-white/30 hover:scale-105"
                        }`}
                        style={{ backgroundColor: colour.value }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-xs font-semibold text-mist">
                      Custom Picker
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-mist">
                        {settings.customColour}
                      </span>
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
                        className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-white/30"
                      />
                    </div>
                  </div>
                </div>

                {/* Card Style Switch */}
                <div className="grid grid-cols-2 gap-2">
                  {(["folder", "card"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() =>
                        handleSaveSettings({ ...settings, cardStyle: style })
                      }
                      className={`py-2 px-3 rounded-xl font-display font-bold text-xs cursor-pointer border transition-ui ${
                        settings.cardStyle === style
                          ? "bg-glow text-abyss border-white"
                          : "bg-abyss/60 text-ink border-mist/25 hover:bg-white/10"
                      }`}
                    >
                      {style === "folder" ? "3D Folders" : "Neon Cards"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notification Sound & Browser Alert Controls */}
              <div className="space-y-2.5 pt-3 border-t border-mist/15">
                <div className="flex items-center gap-2 text-xs font-display font-bold uppercase tracking-wider text-mist">
                  <Bell className="w-4 h-4 text-glow" />
                  <span>Message Alerts</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-abyss/55 border border-mist/20">
                  <span className="text-xs font-semibold text-ink">
                    Notification Sound
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        unlockNotificationAudio();
                        playMessageNotificationSound();
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white/10 hover:bg-white/20 text-ink cursor-pointer"
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      onClick={toggleSound}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        soundEnabled
                          ? "bg-glow text-abyss"
                          : "bg-abyss text-mist border border-mist/30"
                      }`}
                    >
                      {soundEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                </div>

                {notifPermission !== "unsupported" && (
                  <button
                    type="button"
                    onClick={() => void handleEnableBrowserAlerts()}
                    className="w-full py-2.5 px-3 rounded-xl font-display font-bold text-xs text-ink bg-accent/50 hover:bg-accent border border-mist/35 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>
                      {notifPermission === "granted"
                        ? "Browser Notifications Allowed ✓"
                        : "Allow Browser Notifications"}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="space-y-2.5 pt-4 border-t border-mist/15">
              <a
                href={PUBLIC_SITE_URL}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs text-ink flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  background:
                    "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
                  border:
                    "1px solid color-mix(in srgb, var(--ultra-50) 50%, transparent)",
                }}
              >
                <span>Open Live Website</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {adminEmail && (
                <p className="text-[11px] text-mist/75 truncate text-center">
                  {adminEmail}
                </p>
              )}

              <button
                type="button"
                onClick={() => onSignOut?.()}
                className="w-full py-2 px-4 rounded-xl font-display font-semibold text-xs text-mist hover:text-ink hover:bg-white/10 flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ============================================================
          MAIN FULL-SCREEN WORKSPACE
      ============================================================ */}
      <div className="flex-1 min-h-0 w-full flex flex-col overflow-hidden">
        {/* MODULE 1: FULL-SCREEN INSTAGRAM-STYLE CHAT INBOX */}
        <div
          className={
            activeSection === "inbox"
              ? "flex-1 min-h-0 flex flex-col w-full h-full"
              : "hidden"
          }
        >
          <AdminChat
            isActive={activeSection === "inbox"}
            onUnreadChange={setChatUnread}
            soundEnabled={soundEnabled}
            onIncomingAlert={handleIncomingAlert}
          />
        </div>

        {/* MODULE 2: STREAMLINED ANNOUNCEMENT STUDIO */}
        {activeSection === "broadcasts" && (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
            <div className="max-w-5xl mx-auto space-y-6 animate-pop-in">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* Composer Card */}
                <form
                  onSubmit={handlePublishAnnouncement}
                  className="lg:col-span-7 rounded-[24px] p-5 space-y-4"
                  style={{
                    background:
                      "linear-gradient(160deg, color-mix(in srgb, var(--ultra-200) 18%, transparent) 0%, color-mix(in srgb, var(--ultra-800) 32%, transparent) 45%, color-mix(in srgb, var(--ultra-900) 84%, transparent) 100%)",
                    border:
                      "1px solid color-mix(in srgb, var(--ultra-50) 40%, transparent)",
                    boxShadow:
                      "0 18px 40px -12px color-mix(in srgb, var(--ultra-950) 85%, transparent)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-glow" />
                      <h2 className="font-display font-bold text-base text-ink">
                        {editingBcId ? "Edit Announcement" : "New Announcement"}
                      </h2>
                    </div>
                    {editingBcId && (
                      <button
                        type="button"
                        onClick={resetBroadcastForm}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-ink cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {/* Quick Tag Selector Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {BROADCAST_TAGS.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setBcTag(tag)}
                        className={`px-3 py-1 rounded-full text-[11px] font-display font-bold transition-ui cursor-pointer border ${
                          bcTag === tag
                            ? "bg-glow text-abyss border-white"
                            : "bg-abyss/60 text-mist border-mist/25 hover:text-ink"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  <div>
                    <input
                      type="text"
                      required
                      value={bcTitle}
                      onChange={(e) => setBcTitle(e.target.value)}
                      placeholder="Announcement title…"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/80 border border-mist/30 focus:outline-none focus:ring-2 focus:ring-glow"
                    />
                  </div>

                  <div>
                    <textarea
                      rows={4}
                      required
                      value={bcText}
                      onChange={(e) => setBcText(e.target.value)}
                      placeholder="Write your announcement…"
                      className="w-full px-3.5 py-2.5 rounded-xl text-sm text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/80 border border-mist/30 focus:outline-none focus:ring-2 focus:ring-glow resize-none"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                    <div className="relative flex-1">
                      <ImageIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-mist/65" />
                      <input
                        type="url"
                        value={bcImageUrl}
                        onChange={(e) => setBcImageUrl(e.target.value)}
                        placeholder="Image URL (optional)"
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl text-xs text-ink placeholder-[var(--ultra-200)]/55 bg-abyss/80 border border-mist/30 focus:outline-none focus:ring-2 focus:ring-glow"
                      />
                    </div>

                    <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-abyss/60 border border-mist/25 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={bcPinned}
                        onChange={(e) => setBcPinned(e.target.checked)}
                        className="w-4 h-4 rounded accent-[var(--ultra-600)]"
                      />
                      <Pin className="w-3.5 h-3.5 text-glow" />
                      <span className="text-xs font-semibold text-ink">
                        Pin to top
                      </span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isPublishingBc}
                    className="w-full py-3 px-5 rounded-xl font-display font-bold text-sm text-ink flex items-center justify-center gap-2 transition-ui hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
                      border:
                        "1px solid color-mix(in srgb, var(--ultra-50) 60%, transparent)",
                      boxShadow:
                        "0 10px 25px color-mix(in srgb, var(--ultra-600) 50%, transparent)",
                    }}
                  >
                    <Send className="w-4 h-4" />
                    <span>
                      {isPublishingBc
                        ? "Saving…"
                        : editingBcId
                          ? "Update Announcement"
                          : "Publish Announcement"}
                    </span>
                  </button>
                </form>

                {/* Live Preview Card */}
                <div className="lg:col-span-5">
                  <div
                    className="rounded-[22px] p-5 space-y-3"
                    style={{
                      background: "var(--notification-card-background)",
                      backdropFilter: "var(--glass-soft-filter)",
                      border:
                        "1px solid color-mix(in srgb, var(--ultra-50) 45%, transparent)",
                      boxShadow:
                        "0 14px 30px -8px color-mix(in srgb, var(--ultra-950) 70%, transparent)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/55 border border-ink/35 text-ink">
                        {bcTag}
                      </span>
                      <span className="text-[11px] text-mist">Preview</span>
                    </div>

                    <h3 className="font-display font-bold text-base text-ink">
                      {bcTitle.trim() || "Announcement Title"}
                    </h3>

                    <p className="text-xs sm:text-[13px] text-ink/90 leading-relaxed whitespace-pre-wrap">
                      {bcText.trim() ||
                        "Your announcement preview will appear here as you type."}
                    </p>

                    {bcImageUrl.trim() && (
                      <img
                        src={bcImageUrl.trim()}
                        alt="Preview"
                        className="w-full max-h-44 object-cover rounded-xl border border-mist/25 mt-2"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Published Announcements List */}
              {announcements.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-display font-bold text-sm text-mist px-1">
                    Published ({announcements.length})
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {announcements.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[20px] p-4 flex flex-col justify-between gap-3"
                        style={{
                          background:
                            "linear-gradient(155deg, color-mix(in srgb, var(--ultra-200) 16%, transparent) 0%, color-mix(in srgb, var(--ultra-900) 78%, transparent) 100%)",
                          border:
                            "1px solid color-mix(in srgb, var(--ultra-50) 30%, transparent)",
                        }}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/45 border border-mist/35 text-ink">
                              {item.isPinned && <Pin className="w-2.5 h-2.5" />}
                              {item.tag || "Official Broadcast"}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleTogglePinAnnouncement(item)
                                }
                                title={item.isPinned ? "Unpin" : "Pin"}
                                className={`p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                  item.isPinned
                                    ? "bg-accent text-white border-white/50"
                                    : "bg-abyss/50 text-mist border-mist/25 hover:text-white"
                                }`}
                              >
                                <Pin className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditAnnouncement(item)}
                                title="Edit"
                                className="p-1.5 rounded-lg bg-abyss/50 hover:bg-white/15 text-mist hover:text-white border border-mist/25 cursor-pointer transition-colors"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteAnnouncement(item.id)
                                }
                                title="Delete"
                                className="p-1.5 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/40 text-[#FCA5A5] border border-[#EF4444]/35 cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <h4 className="font-display font-bold text-sm sm:text-base text-ink mb-1">
                            {item.title}
                          </h4>
                          <p className="text-xs sm:text-[13px] text-ink/85 leading-relaxed whitespace-pre-wrap">
                            {item.text}
                          </p>
                          {item.imageUrl && (
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-full max-h-40 object-cover rounded-xl border border-mist/20 mt-2.5"
                            />
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-mist/15 flex items-center justify-between text-xs text-mist">
                          <span className="inline-flex items-center gap-1 font-semibold text-ink">
                            <Heart className="w-3.5 h-3.5 fill-glow text-glow" />
                            {item.likes || 0}
                          </span>
                          <span>
                            {new Date(item.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
