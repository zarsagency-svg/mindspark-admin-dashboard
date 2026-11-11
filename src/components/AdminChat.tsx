"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Heart,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { adminFetch } from "@/lib/supabase";
import {
  playMessageNotificationSound,
  showBrowserMessageNotification,
} from "@/lib/notifications";
import type { ChatConversationItem, ChatMessageItem } from "./types";

const LIST_POLL_MS = 3_500;
const THREAD_POLL_MS = 2_500;
const MAX_CHARS = 2000;

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const dayFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatClock(epochMs: number): string {
  if (!epochMs) return "";
  return timeFormatter.format(new Date(epochMs));
}

function dayKey(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayLabel(epochMs: number): string {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const key = dayKey(epochMs);
  if (key === dayKey(today.getTime())) return "Today";
  if (key === dayKey(yesterday.getTime())) return "Yesterday";
  return dayFormatter.format(new Date(epochMs));
}

function formatRailTime(epochMs: number): string {
  if (!epochMs) return "";
  if (dayKey(epochMs) === dayKey(Date.now())) return formatClock(epochMs);
  return dayFormatter.format(new Date(epochMs)).replace(/,\s*\d{4}$/, "");
}

function initialsOf(conv: ChatConversationItem): string {
  return (conv.googleAvatarInitials || conv.googleName || "ST")
    .trim()
    .slice(0, 2)
    .toUpperCase();
}

export interface IncomingBannerAlert {
  id: string;
  conversationId: string;
  senderName: string;
  senderAvatar: string;
  senderInitials: string;
  body: string;
}

export interface AdminChatProps {
  onUnreadChange?: (unread: number) => void;
  isActive: boolean;
  soundEnabled: boolean;
  onIncomingAlert?: (alert: IncomingBannerAlert) => void;
}

export const AdminChat: React.FC<AdminChatProps> = ({
  onUnreadChange,
  isActive,
  soundEnabled,
  onIncomingAlert,
}) => {
  const [conversations, setConversations] = useState<ChatConversationItem[]>([]);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [error, setError] = useState("");
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

  // Instagram-style live activity & animations state
  const [incomingWaveConvIds, setIncomingWaveConvIds] = useState<
    Record<string, number>
  >({});
  const [freshMessageIds, setFreshMessageIds] = useState<Set<number>>(
    () => new Set()
  );
  const [likedMessageIds, setLikedMessageIds] = useState<Set<number>>(
    () => new Set()
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedRef = useRef<string | null>(null);
  const knownIdsRef = useRef<Set<number>>(new Set());
  const initializedListRef = useRef(false);
  const prevConvStateRef = useRef<
    Map<string, { lastMessageAt: number; unreadByAdmin: number }>
  >(new Map());
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;

  selectedRef.current = selectedId;
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.googleName, c.googleEmail, c.lastMessagePreview]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [conversations, search]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadByAdmin || 0), 0),
    [conversations]
  );

  useEffect(() => {
    onUnreadChange?.(totalUnread);
  }, [totalUnread, onUnreadChange]);

  const triggerIncomingWave = useCallback((convId: string) => {
    setIncomingWaveConvIds((prev) => ({ ...prev, [convId]: Date.now() }));
    window.setTimeout(() => {
      setIncomingWaveConvIds((prev) => {
        const copy = { ...prev };
        delete copy[convId];
        return copy;
      });
    }, 3200);
  }, []);

  const notifyNewVisitorMessage = useCallback(
    (conv: ChatConversationItem, messageBody: string) => {
      triggerIncomingWave(conv.id);
      if (soundEnabledRef.current) {
        playMessageNotificationSound();
      }
      showBrowserMessageNotification({
        senderName: conv.googleName || "New Message",
        body: messageBody,
        avatar: conv.googleAvatar,
        conversationId: conv.id,
        onClick: () => {
          setSelectedId(conv.id);
          setMobileThreadOpen(true);
        },
      });
      onIncomingAlert?.({
        id: `${conv.id}-${Date.now()}`,
        conversationId: conv.id,
        senderName: conv.googleName || "Visitor",
        senderAvatar: conv.googleAvatar || "",
        senderInitials: initialsOf(conv),
        body: messageBody,
      });
    },
    [onIncomingAlert, triggerIncomingWave]
  );

  const loadConversations = useCallback(async () => {
    try {
      const res = await adminFetch("/api/chat");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not load chats");
      }
      const d = await res.json();
      const next: ChatConversationItem[] = d.conversations || [];

      if (initializedListRef.current) {
        for (const conv of next) {
          const prev = prevConvStateRef.current.get(conv.id);
          const isNewVisitorMsg =
            conv.lastSender === "visitor" &&
            ((!prev && conv.unreadByAdmin > 0) ||
              (prev &&
                (conv.lastMessageAt > prev.lastMessageAt ||
                  conv.unreadByAdmin > prev.unreadByAdmin)));

          if (isNewVisitorMsg) {
            notifyNewVisitorMessage(
              conv,
              conv.lastMessagePreview || "Sent you a message"
            );
          }
        }
      }

      const nextMap = new Map<
        string,
        { lastMessageAt: number; unreadByAdmin: number }
      >();
      for (const conv of next) {
        nextMap.set(conv.id, {
          lastMessageAt: conv.lastMessageAt,
          unreadByAdmin: conv.unreadByAdmin,
        });
      }
      prevConvStateRef.current = nextMap;
      initializedListRef.current = true;

      setConversations(next);
      setError("");

      setSelectedId((prev) => {
        if (prev && next.some((c) => c.id === prev)) return prev;
        if (next.length === 0) return null;
        return prev ?? next[0].id;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load chats");
    } finally {
      setIsLoadingList(false);
    }
  }, [notifyNewVisitorMessage]);

  const loadThread = useCallback(
    async (id: string, opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setIsLoadingThread(true);
      try {
        const res = await adminFetch(
          `/api/chat/conversation?id=${encodeURIComponent(id)}`
        );
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Could not load this chat");
        }
        const d = await res.json();
        const next: ChatMessageItem[] = d.messages || [];

        if (knownIdsRef.current.size > 0) {
          const newlyArrivedVisitorMsgs = next.filter(
            (m) => !knownIdsRef.current.has(m.id) && m.sender === "visitor"
          );
          if (newlyArrivedVisitorMsgs.length > 0) {
            setFreshMessageIds((prev) => {
              const updated = new Set(prev);
              for (const m of newlyArrivedVisitorMsgs) updated.add(m.id);
              return updated;
            });
            const latest =
              newlyArrivedVisitorMsgs[newlyArrivedVisitorMsgs.length - 1];
            const convObj: ChatConversationItem | undefined =
              d.conversation || conversations.find((c) => c.id === id);
            if (convObj) {
              // Update prevConvStateRef so list poll doesn't double-fire for the same message
              prevConvStateRef.current.set(id, {
                lastMessageAt: Math.max(
                  convObj.lastMessageAt || 0,
                  latest.createdAt
                ),
                unreadByAdmin: 0,
              });
              notifyNewVisitorMessage(convObj, latest.body);
            }
          }
        }

        knownIdsRef.current = new Set(next.map((m) => m.id));
        setMessages(next);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, ...(d.conversation || {}), unreadByAdmin: 0 }
              : c
          )
        );
        setError("");
      } catch (e) {
        if (!opts.silent) {
          setError(e instanceof Error ? e.message : "Could not load this chat");
        }
      } finally {
        if (!opts.silent) setIsLoadingThread(false);
      }
    },
    [conversations, notifyNewVisitorMessage]
  );

  // Initial list load + background polling
  useEffect(() => {
    void loadConversations();
    const timer = setInterval(() => void loadConversations(), LIST_POLL_MS);
    const onFocus = () => {
      void loadConversations();
      if (selectedRef.current)
        void loadThread(selectedRef.current, { silent: true });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadConversations, loadThread]);

  // Selected thread polling
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    knownIdsRef.current = new Set();
    void loadThread(selectedId);
    if (!isActive) return;
    const timer = setInterval(
      () => void loadThread(selectedId, { silent: true }),
      THREAD_POLL_MS
    );
    return () => clearInterval(timer);
  }, [selectedId, isActive, loadThread]);

  // Smooth scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length, selectedId, isLoadingThread, incomingWaveConvIds]);

  const openThread = (id: string) => {
    setSelectedId(id);
    setMobileThreadOpen(true);
    setDraft("");
    window.setTimeout(() => composerRef.current?.focus(), 60);
  };

  const toggleLikeMessage = (msgId: number) => {
    setLikedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  const sendMessageBody = async (rawBody: string) => {
    const body = rawBody.trim();
    if (!body || !selectedId || isSending) return;

    setIsSending(true);
    const optimisticId = -Date.now();
    setFreshMessageIds((prev) => new Set(prev).add(optimisticId));
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        conversationId: selectedId,
        sender: "admin",
        body,
        createdAt: Date.now(),
      },
    ]);
    setDraft("");
    if (composerRef.current) {
      composerRef.current.style.height = "auto";
    }

    try {
      const res = await adminFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, body }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Message not sent");

      const saved: ChatMessageItem | undefined = d.message;
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        if (saved && !knownIdsRef.current.has(saved.id)) {
          knownIdsRef.current.add(saved.id);
          setFreshMessageIds((old) => new Set(old).add(saved.id));
          return [...withoutOptimistic, saved];
        }
        return withoutOptimistic;
      });
      if (d.conversation) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId ? { ...c, ...d.conversation } : c
          )
        );
      }
      setError("");
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setDraft(body);
      setError(e instanceof Error ? e.message : "Message not sent");
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    await sendMessageBody(draft);
  };

  const handleDeleteThread = async () => {
    if (!selected) return;
    const label = selected.googleName || selected.googleEmail || "this chat";
    if (!window.confirm(`Delete conversation with ${label}?`)) return;

    try {
      const res = await adminFetch(
        `/api/chat/conversation?id=${encodeURIComponent(selected.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not delete chat");
      }
      setConversations((prev) => prev.filter((c) => c.id !== selected.id));
      setMessages([]);
      setSelectedId(null);
      setMobileThreadOpen(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete chat");
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { label: string; items: ChatMessageItem[] }[] = [];
    for (const msg of messages) {
      const label = formatDayLabel(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(msg);
      else groups.push({ label, items: [msg] });
    }
    return groups;
  }, [messages]);

  const isSelectedMessagingNow = Boolean(
    selected && incomingWaveConvIds[selected.id]
  );

  const rail = (
    <div className="flex flex-col h-full min-h-0 bg-abyss/40">
      {/* Search & Header */}
      <div className="px-3.5 py-3 border-b border-mist/15 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-extrabold text-base text-ink tracking-tight">
              Messages
            </h2>
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-glow text-abyss">
                {totalUnread}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setIsLoadingList(true);
              void loadConversations();
              if (selectedId) void loadThread(selectedId, { silent: true });
            }}
            aria-label="Refresh messages"
            className="p-2 rounded-full text-mist hover:text-ink hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoadingList ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-mist/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full pl-9 pr-3.5 py-2 rounded-full text-xs text-ink placeholder-[var(--ultra-200)]/60 bg-abyss/80 border border-mist/25 focus:outline-none focus:ring-2 focus:ring-glow"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoadingList && conversations.length === 0 ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="flex items-center gap-3 animate-pulse opacity-60"
              >
                <div className="w-12 h-12 rounded-full bg-royal/60 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded bg-royal/60" />
                  <div className="h-2.5 w-40 rounded bg-royal/40" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <MessageCircle className="w-9 h-9 mx-auto text-glow/60" />
            <p className="text-xs text-mist/75">
              {conversations.length === 0 ? "No chats yet" : "No matches"}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-mist/10">
            {filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedId;
              const hasUnread = conv.unreadByAdmin > 0;
              const isMessagingNow = Boolean(incomingWaveConvIds[conv.id]);

              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => openThread(conv.id)}
                    className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition-ui cursor-pointer ${
                      isSelected
                        ? "bg-accent/30 border-l-[3px] border-glow"
                        : "hover:bg-white/5 border-l-[3px] border-transparent"
                    }`}
                  >
                    {/* Instagram-style Avatar with Story Ring on Unread/Active */}
                    <span
                      className={`relative shrink-0 p-[2px] rounded-full ${
                        hasUnread || isMessagingNow
                          ? "bg-[linear-gradient(135deg,var(--ultra-400),var(--ultra-600),#ec4899)] animate-ig-ring"
                          : "bg-transparent"
                      }`}
                    >
                      {conv.googleAvatar ? (
                        <img
                          src={conv.googleAvatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover border border-abyss"
                        />
                      ) : (
                        <span className="w-11 h-11 rounded-full grid place-items-center font-display font-bold text-xs text-ink border border-ink/30 bg-[linear-gradient(145deg,var(--ultra-600),var(--ultra-900))]">
                          {initialsOf(conv)}
                        </span>
                      )}
                      {(hasUnread || isMessagingNow) && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-[#10B981] border-2 border-abyss" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate font-display text-[13.5px] ${
                            hasUnread
                              ? "font-extrabold text-ink"
                              : "font-bold text-ink/90"
                          }`}
                        >
                          {conv.googleName || "Visitor"}
                        </span>
                        <span className="shrink-0 text-[10px] text-mist/70">
                          {formatRailTime(conv.lastMessageAt)}
                        </span>
                      </span>

                      {isMessagingNow ? (
                        <span className="mt-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-glow">
                          <span className="inline-flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-glow ig-typing-dot" />
                            <span className="w-1.5 h-1.5 rounded-full bg-glow ig-typing-dot" />
                            <span className="w-1.5 h-1.5 rounded-full bg-glow ig-typing-dot" />
                          </span>
                          <span>Messaging you…</span>
                        </span>
                      ) : (
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1 min-w-0">
                            {conv.lastSender === "admin" && (
                              <CheckCheck className="w-3.5 h-3.5 shrink-0 text-glow" />
                            )}
                            <span
                              className={`truncate text-xs ${
                                hasUnread
                                  ? "text-ink font-bold"
                                  : "text-mist/75"
                              }`}
                            >
                              {conv.lastMessagePreview || "No messages"}
                            </span>
                          </span>

                          {hasUnread && (
                            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full grid place-items-center text-[10px] font-extrabold text-abyss bg-glow">
                              {conv.unreadByAdmin}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const thread = selected ? (
    <div className="flex flex-col h-full min-h-0">
      {/* Instagram Direct Style Thread Header */}
      <div className="px-4 py-2.5 flex items-center gap-3 border-b border-mist/15 bg-abyss/60 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileThreadOpen(false)}
          aria-label="Back"
          className="lg:hidden p-2 -ml-1 rounded-full text-ink hover:bg-white/10 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="relative shrink-0">
          {selected.googleAvatar ? (
            <img
              src={selected.googleAvatar}
              alt=""
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border border-ink/35"
            />
          ) : (
            <span className="w-10 h-10 rounded-full grid place-items-center font-display font-bold text-xs text-ink border border-ink/35 bg-[linear-gradient(145deg,var(--ultra-600),var(--ultra-900))]">
              {initialsOf(selected)}
            </span>
          )}
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10B981] border-2 border-abyss" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-sm text-ink leading-tight">
            {selected.googleName || "Visitor"}
          </p>
          {isSelectedMessagingNow ? (
            <p className="text-[11px] font-semibold text-glow flex items-center gap-1.5">
              <span className="inline-flex items-center gap-0.5">
                <span className="w-1 h-1 rounded-full bg-glow ig-typing-dot" />
                <span className="w-1 h-1 rounded-full bg-glow ig-typing-dot" />
                <span className="w-1 h-1 rounded-full bg-glow ig-typing-dot" />
              </span>
              <span>Active now · messaging you…</span>
            </p>
          ) : (
            <p className="truncate text-[11px] text-mist/70">
              {selected.googleEmail}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => void loadThread(selected.id, { silent: true })}
          aria-label="Refresh"
          className="p-2 rounded-full text-mist hover:text-ink hover:bg-white/10 cursor-pointer transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => void handleDeleteThread()}
          aria-label="Delete conversation"
          className="p-2 rounded-full text-[#FCA5A5] hover:text-white hover:bg-[#EF4444]/25 cursor-pointer transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Instagram DM Message Feed */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 px-3.5 sm:px-6 py-4 space-y-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--ultra-400) 14%, transparent), transparent 42%), radial-gradient(circle at 82% 78%, color-mix(in srgb, var(--ultra-600) 16%, transparent), transparent 46%)",
        }}
      >
        {isLoadingThread && messages.length === 0 ? (
          <div className="flex justify-center pt-12">
            <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-abyss/70 border border-mist/20">
              <span className="w-2 h-2 rounded-full bg-glow ig-typing-dot" />
              <span className="w-2 h-2 rounded-full bg-glow ig-typing-dot" />
              <span className="w-2 h-2 rounded-full bg-glow ig-typing-dot" />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-3">
            {selected.googleAvatar ? (
              <img
                src={selected.googleAvatar}
                alt=""
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover border-2 border-glow/60"
              />
            ) : (
              <span className="w-16 h-16 rounded-full grid place-items-center font-display font-bold text-lg text-ink border-2 border-glow/60 bg-[linear-gradient(145deg,var(--ultra-600),var(--ultra-900))]">
                {initialsOf(selected)}
              </span>
            )}
            <div>
              <p className="font-display font-bold text-base text-ink">
                {selected.googleName || "Visitor"}
              </p>
              <p className="text-xs text-mist/70">{selected.googleEmail}</p>
            </div>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.label} className="space-y-2.5">
              <div className="flex justify-center my-2">
                <span className="px-3 py-0.5 rounded-full text-[10px] font-semibold text-mist/80 bg-abyss/60 border border-mist/15">
                  {group.label}
                </span>
              </div>

              {group.items.map((msg, idx) => {
                const mine = msg.sender === "admin";
                const pending = msg.id < 0;
                const isFresh = freshMessageIds.has(msg.id);
                const isLiked = likedMessageIds.has(msg.id);
                const isLastInGroup = idx === group.items.length - 1;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-end gap-2 group ${
                      mine ? "justify-end" : "justify-start"
                    } ${
                      isFresh
                        ? mine
                          ? "animate-ig-sent"
                          : "animate-ig-incoming"
                        : ""
                    }`}
                  >
                    {!mine && (
                      <div className="shrink-0 mb-1">
                        {selected.googleAvatar ? (
                          <img
                            src={selected.googleAvatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-7 h-7 rounded-full object-cover border border-ink/30"
                          />
                        ) : (
                          <span className="w-7 h-7 rounded-full grid place-items-center font-display font-bold text-[10px] text-ink border border-ink/30 bg-[linear-gradient(145deg,var(--ultra-600),var(--ultra-900))]">
                            {initialsOf(selected)}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="relative max-w-[80%] sm:max-w-[66%]">
                      <div
                        onDoubleClick={() => toggleLikeMessage(msg.id)}
                        className={`rounded-[22px] px-4 py-2.5 select-text cursor-pointer transition-transform active:scale-[0.98] ${
                          mine ? "rounded-br-[6px]" : "rounded-bl-[6px]"
                        }`}
                        style={
                          mine
                            ? {
                                background:
                                  "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
                                border:
                                  "1px solid color-mix(in srgb, var(--ultra-50) 45%, transparent)",
                                boxShadow:
                                  "0 8px 24px -8px color-mix(in srgb, var(--ultra-600) 65%, transparent)",
                              }
                            : {
                                background:
                                  "linear-gradient(145deg, color-mix(in srgb, var(--ultra-200) 20%, transparent) 0%, color-mix(in srgb, var(--ultra-900) 82%, transparent) 100%)",
                                border:
                                  "1px solid color-mix(in srgb, var(--ultra-50) 30%, transparent)",
                              }
                        }
                      >
                        <p className="text-[13.5px] leading-relaxed text-ink whitespace-pre-wrap break-words">
                          {msg.body}
                        </p>

                        <div
                          className={`mt-1 flex items-center gap-1 text-[10px] ${
                            mine
                              ? "justify-end text-ink/80"
                              : "justify-start text-mist/75"
                          }`}
                        >
                          <span>
                            {pending ? "Sending…" : formatClock(msg.createdAt)}
                          </span>
                          {mine && !pending && (
                            <CheckCheck className="w-3.5 h-3.5 text-ink" />
                          )}
                          {!mine && !pending && <Check className="w-3 h-3" />}
                        </div>
                      </div>

                      {/* Quick Heart Reaction Button on Hover */}
                      <button
                        type="button"
                        onClick={() => toggleLikeMessage(msg.id)}
                        aria-label="React with heart"
                        className={`absolute top-1/2 -translate-y-1/2 ${
                          mine ? "-left-8" : "-right-8"
                        } opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-abyss/80 border border-mist/25 text-mist hover:text-[#FB7185] cursor-pointer`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            isLiked ? "fill-[#FB7185] text-[#FB7185]" : ""
                          }`}
                        />
                      </button>

                      {/* Instagram Floating Heart Badge */}
                      {isLiked && (
                        <span
                          className={`absolute -bottom-2.5 ${
                            mine ? "left-3" : "right-3"
                          } px-1.5 py-0.5 rounded-full bg-abyss border border-mist/35 shadow-md flex items-center animate-ig-heart`}
                        >
                          <Heart className="w-3 h-3 fill-[#FB7185] text-[#FB7185]" />
                        </span>
                      )}

                      {mine && isLastInGroup && !pending && (
                        <span className="block text-right text-[10px] text-mist/65 mt-1 pr-1">
                          {selected.unreadByVisitor === 0 ? "Seen" : "Delivered"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        {/* Instagram-style Live Incoming Wave Indicator Bubble */}
        {isSelectedMessagingNow && (
          <div className="flex items-end gap-2 justify-start animate-ig-incoming">
            {selected.googleAvatar ? (
              <img
                src={selected.googleAvatar}
                alt=""
                referrerPolicy="no-referrer"
                className="w-7 h-7 rounded-full object-cover border border-ink/30"
              />
            ) : (
              <span className="w-7 h-7 rounded-full grid place-items-center font-display font-bold text-[10px] text-ink border border-ink/30 bg-[linear-gradient(145deg,var(--ultra-600),var(--ultra-900))]">
                {initialsOf(selected)}
              </span>
            )}
            <div
              className="rounded-[22px] rounded-bl-[6px] px-4 py-3 flex items-center gap-1.5"
              style={{
                background:
                  "linear-gradient(145deg, color-mix(in srgb, var(--ultra-200) 22%, transparent) 0%, color-mix(in srgb, var(--ultra-900) 85%, transparent) 100%)",
                border:
                  "1px solid color-mix(in srgb, var(--ultra-50) 35%, transparent)",
              }}
            >
              <span className="w-2 h-2 rounded-full bg-ink ig-typing-dot" />
              <span className="w-2 h-2 rounded-full bg-ink ig-typing-dot" />
              <span className="w-2 h-2 rounded-full bg-ink ig-typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Instagram Direct Style Pill Composer */}
      <form
        onSubmit={handleSend}
        className="px-3.5 sm:px-5 py-3 border-t border-mist/15 bg-abyss/70 backdrop-blur-md"
      >
        <div className="flex items-end gap-2 rounded-[26px] px-3.5 py-1.5 bg-abyss/90 border border-mist/35 focus-within:border-glow focus-within:ring-2 focus-within:ring-glow/40">
          <textarea
            ref={composerRef}
            value={draft}
            maxLength={MAX_CHARS}
            rows={1}
            onChange={(e) => {
              setDraft(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Message…"
            className="flex-1 resize-none py-1.5 text-sm text-ink placeholder-[var(--ultra-200)]/55 bg-transparent focus:outline-none max-h-[120px]"
          />

          {!draft.trim() && (
            <div className="hidden sm:flex items-center gap-1 pb-1">
              {["❤️", "🔥", "👏"].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void sendMessageBody(emoji)}
                  disabled={isSending}
                  className="p-1.5 rounded-full hover:bg-white/10 text-sm transition-transform hover:scale-110 cursor-pointer"
                  title={`Send ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="shrink-0 mb-0.5 px-4 py-2 rounded-full font-display font-bold text-xs text-ink flex items-center gap-1.5 transition-ui cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background:
                "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
              border:
                "1px solid color-mix(in srgb, var(--ultra-50) 50%, transparent)",
            }}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSending ? "…" : "Send"}</span>
          </button>
        </div>
      </form>
    </div>
  ) : (
    <div className="h-full grid place-items-center p-6 text-center">
      <div className="space-y-2">
        <MessageCircle className="w-12 h-12 mx-auto text-glow/60" />
        <h3 className="font-display font-bold text-base text-ink">
          Your Messages
        </h3>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 w-full h-full min-h-0 overflow-hidden">
      {error && (
        <div
          className="mx-4 mt-2 rounded-xl px-3.5 py-2 text-xs text-[#F8D3DF] border shrink-0"
          style={{
            background: "rgba(120,15,60,0.35)",
            borderColor: "rgba(248,175,197,0.4)",
          }}
        >
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] w-full h-full overflow-hidden">
        {/* Conversation Rail */}
        <div
          className={`h-full min-h-0 border-r border-mist/15 ${
            mobileThreadOpen && selected ? "hidden lg:block" : "block"
          }`}
        >
          {rail}
        </div>

        {/* Message Thread */}
        <div
          className={`h-full min-h-0 ${
            mobileThreadOpen && selected ? "block" : "hidden lg:block"
          }`}
        >
          {thread}
        </div>
      </div>
    </div>
  );
};

export default AdminChat;
