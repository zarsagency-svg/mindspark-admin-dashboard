"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  Heart,
  LogOut,
  MessageSquarePlus,
  Pin,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  GlassChatBubbleIcon,
  GlassEnvelopeNotificationIcon,
  GoogleGLogo,
} from "./GlassIcons3D";
import {
  GOOGLE_STORAGE_KEY,
  GoogleAuthModal,
  GoogleUserProfile,
} from "./GoogleAuthModal";

export interface AnnouncementItem {
  id: string;
  numericId?: number;
  title: string;
  text: string;
  createdAt: number;
  likes: number;
  liked: boolean;
  tag?: string;
  imageUrl?: string;
  authorName?: string;
  isPinned?: boolean;
}

export interface StudentMessageItem {
  id: number;
  googleEmail: string;
  googleName: string;
  googleAvatar: string;
  googleSub: string;
  category: string;
  subject: string;
  message: string;
  status: "unread" | "read" | "replied";
  adminReply?: string;
  repliedAt?: number | null;
  createdAt: number;
}

const VISITOR_STORAGE_KEY = "mindspark_notification_visitor";
const LAST_SEEN_STORAGE_KEY = "mindspark_notifications_last_seen";

function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "visitor-default-id";
  }
}

function formatTime(ts: number) {
  if (!ts) return "Just now";
  try {
    return new Date(ts).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Just now";
  }
}

interface NotificationsCenterProps {
  externalOpenTab?: "broadcasts" | "message-admin" | null;
  onClearExternalOpen?: () => void;
}

export const NotificationsCenter: React.FC<NotificationsCenterProps> = ({
  externalOpenTab,
  onClearExternalOpen,
}) => {
  const [visitorId, setVisitorId] = useState<string>("visitor-default-id");
  const [unreadCount, setUnreadCount] = useState<number>(1);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"broadcasts" | "message-admin">(
    "broadcasts"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLiking, setIsLiking] = useState(false);
  const [showFloatingToast, setShowFloatingToast] = useState(true);

  // Student Google Account state
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [myMessages, setMyMessages] = useState<StudentMessageItem[]>([]);
  const [msgCategory, setMsgCategory] = useState("Batch Request");
  const [msgSubject, setMsgSubject] = useState("");
  const [msgText, setMsgText] = useState("");
  const [isSendingMsg, setIsSendingMsg] = useState(false);
  const [msgSuccessBanner, setMsgSuccessBanner] = useState("");

  useEffect(() => {
    const vid = getOrCreateVisitorId();
    setVisitorId(vid);
    try {
      const savedGoogle = localStorage.getItem(GOOGLE_STORAGE_KEY);
      if (savedGoogle) {
        setGoogleUser(JSON.parse(savedGoogle));
      }
    } catch {
      // ignore
    }
  }, []);

  const loadAnnouncements = useCallback(
    async (markAsRead = false) => {
      setIsLoading(true);
      setErrorMsg("");
      try {
        const res = await fetch(
          `/api/announcements?visitorId=${encodeURIComponent(visitorId)}`
        );
        if (!res.ok) throw new Error("Failed to fetch announcements");
        const data = await res.json();
        const list: AnnouncementItem[] = data.announcements || [];
        setAnnouncements(list);

        if (markAsRead) {
          try {
            localStorage.setItem(LAST_SEEN_STORAGE_KEY, String(Date.now()));
          } catch {
            // ignore
          }
          setUnreadCount(0);
        } else {
          let lastSeen = 0;
          try {
            lastSeen = Number(localStorage.getItem(LAST_SEEN_STORAGE_KEY)) || 0;
          } catch {
            lastSeen = 0;
          }
          const unread = list.filter((m) => m.createdAt > lastSeen).length;
          setUnreadCount(unread || (lastSeen === 0 && list.length > 0 ? 1 : 0));
        }
      } catch {
        setErrorMsg("Could not refresh live broadcasts.");
      } finally {
        setIsLoading(false);
      }
    },
    [visitorId]
  );

  const loadStudentMessages = useCallback(async (email: string) => {
    if (!email) return;
    try {
      const res = await fetch(
        `/api/messages?email=${encodeURIComponent(email)}`
      );
      if (res.ok) {
        const data = await res.json();
        setMyMessages(data.messages || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadAnnouncements(false);
  }, [loadAnnouncements]);

  useEffect(() => {
    if (googleUser?.googleEmail) {
      loadStudentMessages(googleUser.googleEmail);
    } else {
      setMyMessages([]);
    }
  }, [googleUser, loadStudentMessages]);

  useEffect(() => {
    if (externalOpenTab) {
      setActiveTab(externalOpenTab);
      setShowFloatingToast(false);
      setIsOpen(true);
      if (externalOpenTab === "broadcasts") {
        loadAnnouncements(true);
      }
      onClearExternalOpen?.();
    }
  }, [externalOpenTab, loadAnnouncements, onClearExternalOpen]);

  const openDrawerWithTab = (tab: "broadcasts" | "message-admin") => {
    setActiveTab(tab);
    setShowFloatingToast(false);
    setIsOpen(true);
    if (tab === "broadcasts") {
      loadAnnouncements(true);
    } else if (googleUser?.googleEmail) {
      loadStudentMessages(googleUser.googleEmail);
    }
  };

  const handleToggleLike = async (item: AnnouncementItem) => {
    if (isLiking) return;
    setIsLiking(true);

    const nextLiked = !item.liked;
    setAnnouncements((prev) =>
      prev.map((m) =>
        m.id === item.id
          ? {
              ...m,
              liked: nextLiked,
              likes: Math.max(0, m.likes + (nextLiked ? 1 : -1)),
            }
          : m
      )
    );

    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "like",
          announcementId: Number(item.id),
          visitorId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements((prev) =>
          prev.map((m) =>
            m.id === item.id
              ? { ...m, liked: data.liked, likes: data.likes }
              : m
          )
        );
      }
    } catch {
      // keep optimistic state
    } finally {
      setIsLiking(false);
    }
  };

  const handleSendStudentMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleUser) {
      setIsGoogleModalOpen(true);
      return;
    }
    if (!msgText.trim()) return;

    setIsSendingMsg(true);
    setMsgSuccessBanner("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleEmail: googleUser.googleEmail,
          googleName: googleUser.googleName,
          googleAvatar: googleUser.googleAvatar,
          googleSub: googleUser.googleSub,
          category: msgCategory,
          subject: msgSubject.trim() || `${msgCategory} from ${googleUser.googleName}`,
          message: msgText.trim(),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMyMessages((prev) => [data.message, ...prev]);
        setMsgSubject("");
        setMsgText("");
        setMsgSuccessBanner(
          "Your message has been delivered directly to Mr Sad's Admin Inbox!"
        );
        setTimeout(() => setMsgSuccessBanner(""), 5000);
      }
    } catch {
      setErrorMsg("Failed to send message. Please try again.");
    } finally {
      setIsSendingMsg(false);
    }
  };

  const handleSignOutGoogle = () => {
    try {
      localStorage.removeItem(GOOGLE_STORAGE_KEY);
    } catch {
      // ignore
    }
    setGoogleUser(null);
    setMyMessages([]);
  };

  const latestMsg = announcements[0];

  return (
    <>
      {/* TOP-RIGHT 3D GLASSMORPHIC NOTIFICATION & MESSAGE ADMIN TRIGGERS */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-7 z-40 flex items-center gap-2.5">
        {/* Floating Mini Glass Preview Pill (when unread & closed) */}
        {showFloatingToast && latestMsg && !isOpen && (
          <div
            onClick={() => openDrawerWithTab("broadcasts")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === "Enter" && openDrawerWithTab("broadcasts")
            }
            className="hidden lg:flex items-center gap-3 pl-3.5 pr-2.5 py-2 rounded-2xl cursor-pointer transition-ui duration-200 hover:-translate-y-0.5 group animate-pop-in"
            style={{
              background:
                "linear-gradient(135deg, rgba(175,197,248,0.22) 0%, rgba(26,59,176,0.42) 60%, rgba(15,34,112,0.75) 100%)",
              backdropFilter: "var(--glass-filter)",
              WebkitBackdropFilter: "var(--glass-filter)",
              border: "1px solid rgba(230,237,253,0.38)",
              boxShadow:
                "0 12px 30px -6px rgba(7,16,57,0.75), inset 0 1px 2px rgba(230,237,253,0.4)",
            }}
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E6EDFD]" />
            </span>
            <div className="text-left max-w-[190px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#AFC5F8]">
                Mr Sad · Admin Note
              </p>
              <p className="text-[12px] font-medium text-[#E6EDFD] truncate">
                {latestMsg.title}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowFloatingToast(false);
              }}
              aria-label="Dismiss notification preview"
              className="p-1 rounded-full text-[#AFC5F8] hover:text-[#E6EDFD] hover:bg-[#E6EDFD]/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Message Admin Quick Button */}
        <button
          type="button"
          onClick={() => openDrawerWithTab("message-admin")}
          className="group relative flex items-center gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl transition-ui duration-200 hover:-translate-y-0.5 hover:scale-[1.02] active:scale-95 cursor-pointer"
          style={{
            background:
              "linear-gradient(145deg, rgba(175,197,248,0.25) 0%, rgba(46,93,230,0.38) 55%, rgba(15,34,112,0.78) 100%)",
            backdropFilter: "var(--glass-filter)",
            WebkitBackdropFilter: "var(--glass-filter)",
            border: "1px solid rgba(230,237,253,0.45)",
            boxShadow:
              "0 14px 32px -6px rgba(7,16,57,0.8), 0 0 18px rgba(46,93,230,0.32), inset 0 1.5px 2px rgba(230,237,253,0.45)",
          }}
        >
          <MessageSquarePlus className="w-4 h-4 text-[#E6EDFD]" />
          <span className="text-xs font-display font-bold text-[#E6EDFD] hidden sm:inline">
            Message Admin
          </span>
        </button>

        {/* Main 3D Glass Envelope Trigger Button */}
        <button
          type="button"
          aria-label="Open MIND SPARK Updates & Inbox"
          onClick={() =>
            isOpen ? setIsOpen(false) : openDrawerWithTab("broadcasts")
          }
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
          <GlassEnvelopeNotificationIcon
            className="w-10 h-10 sm:w-11 sm:h-11"
            hasUnread={unreadCount > 0}
          />

          <div className="hidden sm:flex flex-col items-start text-left">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#AFC5F8] leading-none">
              Inbox
            </span>
            <span className="text-[13px] font-display font-bold text-[#E6EDFD] leading-tight mt-0.5">
              Updates
            </span>
          </div>

          {unreadCount > 0 && (
            <span
              className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-extrabold text-[#071039]"
              style={{
                background:
                  "linear-gradient(135deg, #E6EDFD 0%, #AFC5F8 100%)",
                boxShadow:
                  "0 4px 12px rgba(46,93,230,0.8), 0 0 0 2px #0F2270",
              }}
            >
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* 3D GLASSMORPHIC SLIDE-OVER DRAWER */}
      {isOpen && (
        <div
          id="inbox-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="updates-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
          className="drawer-overlay fixed inset-0 z-[60] flex justify-end p-0 sm:p-4 opacity-100"
          style={{
            background: "rgba(7, 16, 57, 0.72)",
            backdropFilter: "var(--glass-overlay-filter)",
            WebkitBackdropFilter: "var(--glass-overlay-filter)",
          }}
        >
          <div
            id="inbox-content"
            className="drawer-panel relative w-full sm:w-[450px] h-full sm:rounded-[28px] overflow-hidden flex flex-col translate-x-0 scale-100"
            style={{
              background:
                "linear-gradient(165deg, rgba(15,34,112,0.92) 0%, rgba(7,16,57,0.96) 60%, rgba(7,16,57,0.99) 100%)",
              border: "1.5px solid rgba(175,197,248,0.38)",
              boxShadow:
                "-20px 0 60px rgba(7,16,57,0.95), 0 0 40px rgba(46,93,230,0.32), inset 0 1.5px 2px rgba(230,237,253,0.35)",
            }}
          >
            {/* Ambient decorative Ultramarine orbs inside drawer */}
            <div
              className="pointer-events-none absolute -top-20 -right-20 w-60 h-60 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(46,93,230,0.38) 0%, transparent 72%)",
              }}
            />
            <div
              className="pointer-events-none absolute bottom-10 -left-20 w-56 h-56 rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgba(110,146,242,0.22) 0%, transparent 72%)",
              }}
            />

            {/* Drawer Header */}
            <div
              className="relative z-10 p-4 sm:p-5 flex flex-col gap-3.5"
              style={{
                background:
                  "linear-gradient(180deg, rgba(175,197,248,0.16) 0%, rgba(26,59,176,0.12) 100%)",
                borderBottom: "1px solid rgba(175,197,248,0.22)",
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <GlassChatBubbleIcon className="w-11 h-11" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h2
                        id="updates-title"
                        className="text-[#E6EDFD] font-display font-bold text-lg tracking-tight"
                      >
                        MIND SPARK Hub
                      </h2>
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#E6EDFD]"
                        style={{
                          background: "rgba(46,93,230,0.45)",
                          border: "1px solid rgba(175,197,248,0.4)",
                        }}
                      >
                        Live
                      </span>
                    </div>
                    <p className="text-[11px] text-[#AFC5F8]">
                      Official Admin Broadcasts & Direct Student Inbox
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadAnnouncements(true)}
                    aria-label="Refresh broadcasts"
                    className="p-2 rounded-full text-[#AFC5F8] hover:text-[#E6EDFD] hover:bg-[#E6EDFD]/15 transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close Inbox"
                    className="p-2 rounded-full text-[#AFC5F8] hover:text-[#E6EDFD] hover:bg-[#E6EDFD]/15 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Dual-Tab Pill Switcher */}
              <div
                className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl"
                style={{
                  background: "rgba(7, 16, 57, 0.65)",
                  border: "1px solid rgba(175, 197, 248, 0.28)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab("broadcasts")}
                  className={`py-2 px-3 rounded-xl font-display font-bold text-xs transition-ui cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "broadcasts"
                      ? "bg-[#2E5DE6] text-[#E6EDFD] shadow-[0_4px_14px_rgba(46,93,230,0.55)]"
                      : "text-[#AFC5F8] hover:text-[#E6EDFD]"
                  }`}
                >
                  <span>Broadcasts</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/15">
                    {announcements.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("message-admin")}
                  className={`py-2 px-3 rounded-xl font-display font-bold text-xs transition-ui cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === "message-admin"
                      ? "bg-[#2E5DE6] text-[#E6EDFD] shadow-[0_4px_14px_rgba(46,93,230,0.55)]"
                      : "text-[#AFC5F8] hover:text-[#E6EDFD]"
                  }`}
                >
                  <MessageSquarePlus className="w-3.5 h-3.5" />
                  <span>Message Admin</span>
                </button>
              </div>
            </div>

            {/* TAB 1: OFFICIAL ADMIN BROADCASTS */}
            {activeTab === "broadcasts" && (
              <div
                id="messages-container"
                className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 no-scrollbar"
              >
                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-2xl p-3.5 text-xs text-[#E6EDFD] flex items-center justify-between"
                    style={{
                      background: "rgba(46,93,230,0.25)",
                      border: "1px solid rgba(175,197,248,0.4)",
                    }}
                  >
                    <span>{errorMsg}</span>
                    <button
                      type="button"
                      onClick={() => loadAnnouncements(true)}
                      className="underline font-semibold ml-2 cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {isLoading && announcements.length === 0 ? (
                  <div className="flex flex-col gap-4">
                    <div className="w-full h-36 rounded-3xl bg-[#1A3BB0]/30 border border-[#6E92F2]/25 animate-pulse" />
                    <div className="w-full h-28 rounded-3xl bg-[#1A3BB0]/20 border border-[#6E92F2]/20 animate-pulse" />
                  </div>
                ) : (
                  announcements.map((msg, index) => {
                    const isLiked = msg.liked;
                    return (
                      <div key={msg.id} className="relative pt-2.5 group">
                        {/* BACK LAYER OF THE DUAL-GLASS CARD */}
                        <div
                          className="pointer-events-none absolute top-0 left-3 right-6 h-10 rounded-t-2xl transition-transform duration-200 group-hover:-translate-y-0.5"
                          style={{
                            transform:
                              index % 2 === 0
                                ? "rotate(-1.2deg)"
                                : "rotate(1.2deg)",
                            background:
                              "linear-gradient(90deg, #2E5DE6 0%, #6E92F2 55%, #1A3BB0 100%)",
                            boxShadow: "0 4px 16px rgba(46,93,230,0.45)",
                            border: "1px solid rgba(230,237,253,0.45)",
                          }}
                        />

                        {/* FRONT LAYER: FROSTED GLASSMORPHISM POCKET CARD */}
                        <div
                          className="relative z-10 rounded-[22px] p-4 sm:p-5 overflow-hidden"
                          style={{
                            background: "var(--notification-card-background)",
                            backdropFilter: "var(--glass-soft-filter)",
                            WebkitBackdropFilter: "var(--glass-soft-filter)",
                            borderTop: "1.5px solid rgba(230,237,253,0.55)",
                            borderLeft: "1px solid rgba(230,237,253,0.35)",
                            borderRight: "1px solid rgba(175,197,248,0.25)",
                            borderBottom: "1.5px solid rgba(7,16,57,0.8)",
                            boxShadow:
                              "0 14px 30px -8px rgba(7,16,57,0.7), inset 0 1.5px 2px rgba(230,237,253,0.35)",
                          }}
                        >
                          {/* Admin Identity Row */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-display font-bold text-xs text-[#E6EDFD]"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #2E5DE6 0%, #1A3BB0 100%)",
                                  border: "1px solid rgba(230,237,253,0.5)",
                                  boxShadow: "0 4px 10px rgba(46,93,230,0.45)",
                                }}
                              >
                                MS
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[#AFC5F8] font-bold text-xs tracking-wider uppercase truncate">
                                    {msg.authorName || "Mr Sad · Admin"}
                                  </span>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-[#6E92F2] shrink-0" />
                                </div>
                                <time className="block mt-0.5 text-[10px] sm:text-[11px] font-medium text-[#AFC5F8]">
                                  {formatTime(msg.createdAt)}
                                </time>
                              </div>
                            </div>

                            {msg.tag && (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-[#E6EDFD] shrink-0"
                                style={{
                                  background: msg.isPinned
                                    ? "linear-gradient(135deg, #2E5DE6 0%, #6E92F2 100%)"
                                    : "rgba(15,34,112,0.65)",
                                  border: "1px solid rgba(230,237,253,0.4)",
                                }}
                              >
                                {msg.isPinned && <Pin className="w-2.5 h-2.5" />}
                                {msg.tag}
                              </span>
                            )}
                          </div>

                          {msg.title && (
                            <h3 className="text-[#E6EDFD] font-display font-bold text-[15px] mb-1.5 leading-snug">
                              {msg.title}
                            </h3>
                          )}

                          <p className="text-[#E6EDFD]/85 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                            {msg.text}
                          </p>

                          {msg.imageUrl && (
                            <img
                              src={msg.imageUrl}
                              alt="Attachment"
                              loading="lazy"
                              decoding="async"
                              className="notification-image mt-3 w-full h-auto rounded-xl border border-white/20"
                            />
                          )}

                          {/* Action Bar */}
                          <div
                            className="mt-4 pt-3 flex items-center justify-between"
                            style={{
                              borderTop: "1px solid rgba(175,197,248,0.2)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleLike(msg)}
                              disabled={isLiking}
                              aria-pressed={isLiked}
                              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-ui duration-200 cursor-pointer ${
                                isLiked
                                  ? "text-[#E6EDFD] scale-105"
                                  : "text-[#AFC5F8] hover:text-[#E6EDFD]"
                              }`}
                              style={{
                                background: isLiked
                                  ? "linear-gradient(135deg, #2E5DE6 0%, #6E92F2 100%)"
                                  : "rgba(15,34,112,0.55)",
                                border: isLiked
                                  ? "1px solid rgba(230,237,253,0.65)"
                                  : "1px solid rgba(175,197,248,0.28)",
                                boxShadow: isLiked
                                  ? "0 4px 14px rgba(46,93,230,0.55)"
                                  : "none",
                              }}
                            >
                              <Heart
                                className={`w-3.5 h-3.5 transition-transform ${
                                  isLiked ? "fill-current scale-110" : ""
                                }`}
                              />
                              <span>{msg.likes || 0} Likes</span>
                            </button>

                            <span className="text-[11px] font-medium text-[#AFC5F8]/75">
                              MIND SPARK Verified
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB 2: STUDENT-TO-ADMIN DIRECT MESSAGING (GOOGLE LOGIN REQUIRED) */}
            {activeTab === "message-admin" && (
              <div className="relative z-10 flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 no-scrollbar">
                {!googleUser ? (
                  /* GOOGLE LOGIN GATE CARD */
                  <div className="relative pt-2.5">
                    <div
                      className="pointer-events-none absolute top-0 left-4 right-6 h-10 rounded-t-2xl"
                      style={{
                        transform: "rotate(-1.2deg)",
                        background:
                          "linear-gradient(90deg, #2E5DE6 0%, #6E92F2 55%, #1A3BB0 100%)",
                        border: "1px solid rgba(230,237,253,0.45)",
                      }}
                    />
                    <div
                      className="relative z-10 rounded-[22px] p-5 text-center space-y-4"
                      style={{
                        background: "var(--notification-card-background)",
                        borderTop: "1.5px solid rgba(230,237,253,0.55)",
                        borderLeft: "1px solid rgba(230,237,253,0.35)",
                        borderRight: "1px solid rgba(175,197,248,0.25)",
                        borderBottom: "1.5px solid rgba(7,16,57,0.8)",
                        boxShadow: "0 14px 30px -8px rgba(7,16,57,0.75)",
                      }}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white mx-auto flex items-center justify-center shadow-lg">
                        <GoogleGLogo className="w-7 h-7" />
                      </div>
                      <div>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#2E5DE6]/40 border border-[#AFC5F8]/40 text-[#E6EDFD] mb-2">
                          <ShieldCheck className="w-3 h-3" />
                          Verified Student Channel
                        </span>
                        <h3 className="font-display font-bold text-lg text-[#E6EDFD]">
                          Message Mr Sad (Admin)
                        </h3>
                        <p className="text-xs text-[#AFC5F8] mt-1 leading-relaxed">
                          Have a batch request, study doubt, or broken lecture
                          link? Sign in with your Google Account to send a
                          direct message to Admin and receive official replies.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsGoogleModalOpen(true)}
                        className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-[#E6EDFD] text-[#071039] font-display font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-ui cursor-pointer"
                      >
                        <GoogleGLogo className="w-4 h-4" />
                        <span>Sign in with Google Account</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* SIGNED-IN STUDENT MESSAGE COMPOSER & THREAD */
                  <>
                    {/* Verified Google Profile Bar */}
                    <div
                      className="rounded-2xl p-3.5 flex items-center justify-between gap-3"
                      style={{
                        background:
                          "linear-gradient(145deg, rgba(175,197,248,0.20) 0%, rgba(15,34,112,0.75) 100%)",
                        border: "1px solid rgba(230,237,253,0.4)",
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-display font-bold text-xs text-[#E6EDFD] shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg, #2E5DE6 0%, #6E92F2 100%)",
                            border: "1.5px solid rgba(230,237,253,0.7)",
                          }}
                        >
                          {googleUser.googleAvatar}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-display font-bold text-sm text-[#E6EDFD] truncate">
                              {googleUser.googleName}
                            </p>
                            <GoogleGLogo className="w-3.5 h-3.5 shrink-0" />
                          </div>
                          <p className="text-[11px] text-[#AFC5F8] truncate">
                            {googleUser.googleEmail}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleSignOutGoogle}
                        title="Sign out of Google Account"
                        className="p-2 rounded-xl text-xs font-semibold text-[#AFC5F8] hover:text-white hover:bg-white/10 flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>

                    {/* Message Composer Form */}
                    <form
                      onSubmit={handleSendStudentMessage}
                      className="rounded-[22px] p-4 sm:p-5 space-y-3.5"
                      style={{
                        background: "var(--notification-card-background)",
                        borderTop: "1.5px solid rgba(230,237,253,0.55)",
                        borderLeft: "1px solid rgba(230,237,253,0.35)",
                        borderRight: "1px solid rgba(175,197,248,0.25)",
                        borderBottom: "1.5px solid rgba(7,16,57,0.8)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-display font-bold text-sm text-[#E6EDFD] flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-[#6E92F2]" />
                          <span>Send Direct Message to Admin</span>
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#AFC5F8]">
                          Google Verified
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#AFC5F8] mb-1">
                            Topic Category
                          </label>
                          <select
                            value={msgCategory}
                            onChange={(e) => setMsgCategory(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl text-xs text-[#E6EDFD] bg-[#071039]/80 border border-[#AFC5F8]/35 focus:outline-none focus:ring-2 focus:ring-[#6E92F2]"
                          >
                            <option value="Batch Request">Batch Request</option>
                            <option value="Technical Support">
                              Broken Link / Server
                            </option>
                            <option value="Study Doubt">Study Doubt</option>
                            <option value="Appreciation & Feedback">
                              Appreciation & Feedback
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#AFC5F8] mb-1">
                            Subject / Batch Name
                          </label>
                          <input
                            type="text"
                            value={msgSubject}
                            onChange={(e) => setMsgSubject(e.target.value)}
                            placeholder="e.g. Class 12 Physics Notes"
                            className="w-full px-3 py-2 rounded-xl text-xs text-[#E6EDFD] placeholder-[#AFC5F8]/55 bg-[#071039]/80 border border-[#AFC5F8]/35 focus:outline-none focus:ring-2 focus:ring-[#6E92F2]"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-[#AFC5F8] mb-1">
                          Your Message to Mr Sad
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={msgText}
                          onChange={(e) => setMsgText(e.target.value)}
                          placeholder="Write your message, batch request, or question for Admin..."
                          className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-[#E6EDFD] placeholder-[#AFC5F8]/55 bg-[#071039]/80 border border-[#AFC5F8]/35 focus:outline-none focus:ring-2 focus:ring-[#6E92F2] resize-none"
                        />
                      </div>

                      {msgSuccessBanner && (
                        <div className="p-3 rounded-xl bg-[#10B981]/20 border border-[#10B981]/50 text-xs font-medium text-[#E6EDFD] flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                          <span>{msgSuccessBanner}</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={isSendingMsg}
                        className="w-full py-2.5 px-4 rounded-xl font-display font-bold text-xs sm:text-sm text-[#E6EDFD] flex items-center justify-center gap-2 transition-ui hover:-translate-y-0.5 cursor-pointer"
                        style={{
                          background:
                            "linear-gradient(135deg, #2E5DE6 0%, #6E92F2 100%)",
                          border: "1px solid rgba(230,237,253,0.55)",
                          boxShadow: "0 8px 20px rgba(46,93,230,0.5)",
                        }}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isSendingMsg
                            ? "Sending to Admin..."
                            : "Send Message to Admin"}
                        </span>
                      </button>
                    </form>

                    {/* Student's Sent Messages & Admin Replies */}
                    <div className="space-y-3">
                      <h4 className="font-display font-bold text-xs uppercase tracking-wider text-[#AFC5F8] px-1">
                        Your Message History ({myMessages.length})
                      </h4>

                      {myMessages.length === 0 ? (
                        <div className="rounded-2xl p-4 text-center text-xs text-[#AFC5F8]/80 bg-[#071039]/40 border border-[#AFC5F8]/20">
                          No messages sent from {googleUser.googleEmail} yet.
                        </div>
                      ) : (
                        myMessages.map((m) => (
                          <div
                            key={m.id}
                            className="rounded-2xl p-4 space-y-2.5"
                            style={{
                              background: "rgba(15, 34, 112, 0.55)",
                              border: "1px solid rgba(175, 197, 248, 0.3)",
                            }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#2E5DE6]/40 text-[#E6EDFD] border border-[#AFC5F8]/30">
                                {m.category}
                              </span>
                              <span className="text-[10px] text-[#AFC5F8]">
                                {formatTime(m.createdAt)}
                              </span>
                            </div>
                            {m.subject && (
                              <p className="font-display font-bold text-xs text-[#E6EDFD]">
                                {m.subject}
                              </p>
                            )}
                            <p className="text-xs text-[#E6EDFD]/90 leading-relaxed">
                              {m.message}
                            </p>

                            {m.adminReply ? (
                              <div
                                className="mt-2 p-3 rounded-xl space-y-1"
                                style={{
                                  background:
                                    "linear-gradient(135deg, rgba(46,93,230,0.35) 0%, rgba(15,34,112,0.85) 100%)",
                                  border: "1px solid rgba(230,237,253,0.45)",
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#AFC5F8]">
                                    Mr Sad · Official Admin Reply
                                  </span>
                                  <CheckCircle2 className="w-3 h-3 text-[#6E92F2]" />
                                </div>
                                <p className="text-xs text-[#E6EDFD] leading-relaxed">
                                  {m.adminReply}
                                </p>
                              </div>
                            ) : (
                              <p className="text-[10px] text-[#AFC5F8]/70 italic">
                                Status: Delivered to Admin Inbox · Awaiting reply
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* GOOGLE OAUTH SIGN-IN MODAL */}
      <GoogleAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onSuccess={(profile) => setGoogleUser(profile)}
      />
    </>
  );
};
