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
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { adminFetch } from "@/lib/supabase";
import type { ChatConversationItem, ChatMessageItem } from "./types";

const GLASS_PANEL: React.CSSProperties = {
  background:
    "linear-gradient(160deg, color-mix(in srgb, var(--ultra-200) 18%, transparent) 0%, color-mix(in srgb, var(--ultra-800) 28%, transparent) 45%, color-mix(in srgb, var(--ultra-900) 78%, transparent) 100%)",
  borderTop: "1.5px solid color-mix(in srgb, var(--ultra-50) 50%, transparent)",
  borderLeft: "1px solid color-mix(in srgb, var(--ultra-50) 30%, transparent)",
  borderRight: "1px solid color-mix(in srgb, var(--ultra-200) 22%, transparent)",
  borderBottom: "1.5px solid color-mix(in srgb, var(--ultra-950) 82%, transparent)",
  boxShadow: "0 18px 40px -12px color-mix(in srgb, var(--ultra-950) 85%, transparent)",
};

const LIST_POLL_MS = 10_000;
const THREAD_POLL_MS = 5_000;
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

/** Compact stamp for the conversation rail: time today, date otherwise. */
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

export interface AdminChatProps {
  /** Reports the total unread count so the sidebar badge stays live. */
  onUnreadChange?: (unread: number) => void;
  /** True when the chat module is the visible section (drives thread polling). */
  isActive: boolean;
}

/**
 * MODULE 2 — WhatsApp-style two-way chat with Google-signed-in visitors.
 *
 * The visitor side lives on mindspark-all inside the notification drawer. Both
 * ends talk to security-definer RPCs; identity comes from the verified Google
 * auth record, never from the request body.
 */
export const AdminChat: React.FC<AdminChatProps> = ({
  onUnreadChange,
  isActive,
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

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const selectedRef = useRef<string | null>(null);
  const knownIdsRef = useRef<Set<number>>(new Set());

  selectedRef.current = selectedId;
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const filteredConversations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      [c.googleName, c.googleEmail, c.lastMessagePreview]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [conversations, search]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadByAdmin || 0), 0),
    [conversations],
  );

  useEffect(() => {
    onUnreadChange?.(totalUnread);
  }, [totalUnread, onUnreadChange]);

  const loadConversations = useCallback(async () => {
    try {
      const res = await adminFetch("/api/chat");
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not load chats");
      }
      const d = await res.json();
      const next: ChatConversationItem[] = d.conversations || [];
      setConversations(next);
      setError("");

      // Keep a thread open if the visitor deleted theirs, otherwise auto-open
      // the first conversation on desktop so the pane is never blank.
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
  }, []);

  const loadThread = useCallback(
    async (id: string, opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setIsLoadingThread(true);
      try {
        const res = await adminFetch(`/api/chat/conversation?id=${encodeURIComponent(id)}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Could not load this chat");
        }
        const d = await res.json();
        const next: ChatMessageItem[] = d.messages || [];
        knownIdsRef.current = new Set(next.map((m) => m.id));
        setMessages(next);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === id
              ? { ...c, ...(d.conversation || {}), unreadByAdmin: 0 }
              : c,
          ),
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
    [],
  );

  // Initial list load + background polling.
  useEffect(() => {
    loadConversations();
    const timer = setInterval(loadConversations, LIST_POLL_MS);
    const onFocus = () => {
      loadConversations();
      if (selectedRef.current) loadThread(selectedRef.current, { silent: true });
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadConversations, loadThread]);

  // Load the selected thread, then poll it while the module is visible.
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    knownIdsRef.current = new Set();
    loadThread(selectedId);
    if (!isActive) return;
    const timer = setInterval(
      () => loadThread(selectedId, { silent: true }),
      THREAD_POLL_MS,
    );
    return () => clearInterval(timer);
  }, [selectedId, isActive, loadThread]);

  // Scroll to the newest bubble whenever messages change.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, selectedId, isLoadingThread]);

  const openThread = (id: string) => {
    setSelectedId(id);
    setMobileThreadOpen(true);
    setDraft("");
    window.setTimeout(() => composerRef.current?.focus(), 60);
  };

  const handleSend = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || !selectedId || isSending) return;

    setIsSending(true);
    const optimisticId = -Date.now();
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
          return [...withoutOptimistic, saved];
        }
        return withoutOptimistic;
      });
      if (d.conversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, ...d.conversation } : c)),
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

  const handleDeleteThread = async () => {
    if (!selected) return;
    const label = selected.googleName || selected.googleEmail || "this chat";
    if (!window.confirm(`Delete the whole conversation with ${label}?`)) return;

    try {
      const res = await adminFetch(
        `/api/chat/conversation?id=${encodeURIComponent(selected.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not delete the chat");
      }
      setConversations((prev) => prev.filter((c) => c.id !== selected.id));
      setMessages([]);
      setSelectedId(null);
      setMobileThreadOpen(false);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the chat");
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

  const rail = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-mist/20 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-mist">
              WhatsApp-style inbox
            </p>
            <h3 className="font-display font-bold text-sm text-ink">
              {conversations.length}{" "}
              {conversations.length === 1 ? "conversation" : "conversations"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsLoadingList(true);
              loadConversations();
              if (selectedId) loadThread(selectedId, { silent: true });
            }}
            aria-label="Refresh chats"
            className="p-2 rounded-xl text-mist hover:text-white bg-abyss/55 border border-mist/30 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingList ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-mist/70" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or message…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs text-ink placeholder-[var(--ultra-200)]/60 bg-abyss/75 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoadingList && conversations.length === 0 ? (
          <p className="p-5 text-xs text-mist/80 text-center">
            Loading conversations…
          </p>
        ) : filteredConversations.length === 0 ? (
          <div className="p-6 text-center space-y-2">
            <MessageCircle className="w-9 h-9 mx-auto text-glow/70" />
            <p className="text-xs text-mist/85">
              {conversations.length === 0
                ? "No chats yet. Messages sent from the website appear here instantly."
                : "No conversation matches that search."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-mist/12">
            {filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedId;
              return (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => openThread(conv.id)}
                    className={`w-full text-left px-3 py-3 flex items-start gap-3 transition-ui cursor-pointer ${
                      isSelected
                        ? "bg-accent/35 border-l-2 border-glow"
                        : "hover:bg-mist/10 border-l-2 border-transparent"
                    }`}
                  >
                    <span className="relative shrink-0">
                      {conv.googleAvatar ? (
                        <img
                          src={conv.googleAvatar}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover border border-ink/40"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-full grid place-items-center font-display font-bold text-xs text-ink border border-ink/35 bg-[linear-gradient(145deg,var(--ultra-600),var(--ultra-900))]">
                          {initialsOf(conv)}
                        </span>
                      )}
                      {conv.unreadByAdmin > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center text-[10px] font-bold text-abyss bg-glow border border-ink/60">
                          {conv.unreadByAdmin}
                        </span>
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-display font-bold text-[13px] text-ink">
                          {conv.googleName || "Google user"}
                        </span>
                        <span className="shrink-0 text-[10px] text-mist/75">
                          {formatRailTime(conv.lastMessageAt)}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        {conv.lastSender === "admin" && (
                          <CheckCheck className="w-3 h-3 shrink-0 text-glow" />
                        )}
                        <span
                          className={`truncate text-[11px] ${
                            conv.unreadByAdmin > 0
                              ? "text-ink font-semibold"
                              : "text-mist/80"
                          }`}
                        >
                          {conv.lastMessagePreview || "No messages yet"}
                        </span>
                      </span>
                      <span className="block truncate text-[10px] text-mist/55 mt-0.5">
                        {conv.googleEmail || "legacy visitor thread"}
                      </span>
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
      {/* Thread header */}
      <div className="px-3 sm:px-4 py-3 flex items-center gap-3 border-b border-mist/20 bg-abyss/45">
        <button
          type="button"
          onClick={() => setMobileThreadOpen(false)}
          aria-label="Back to conversations"
          className="lg:hidden p-1.5 rounded-lg text-mist hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {selected.googleAvatar ? (
          <img
            src={selected.googleAvatar}
            alt=""
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-full object-cover border border-ink/40"
          />
        ) : (
          <span className="w-10 h-10 rounded-full grid place-items-center font-display font-bold text-xs text-ink border border-ink/35 bg-[linear-gradient(145deg,var(--ultra-600),var(--ultra-900))]">
            {initialsOf(selected)}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate font-display font-bold text-sm text-ink">
            {selected.googleName || "Google user"}
          </p>
          <p className="truncate text-[11px] text-mist/80 flex items-center gap-1.5">
            <ShieldCheck className="w-3 h-3 text-glow shrink-0" />
            {selected.googleEmail || "Verified visitor thread"}
            {selected.unreadByVisitor > 0
              ? ` · ${selected.unreadByVisitor} unread by them`
              : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadThread(selected.id, { silent: true })}
          aria-label="Refresh conversation"
          className="p-2 rounded-xl text-mist hover:text-white bg-abyss/55 border border-mist/30 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDeleteThread}
          aria-label="Delete conversation"
          className="p-2 rounded-xl text-[#F8AFC5] hover:text-white bg-abyss/55 border border-[#F8AFC5]/30 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bubbles */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 px-3 sm:px-5 py-4 space-y-4"
        style={{
          backgroundImage:
            "radial-gradient(circle at 18% 12%, color-mix(in srgb, var(--ultra-400) 16%, transparent), transparent 42%), radial-gradient(circle at 82% 78%, color-mix(in srgb, var(--ultra-600) 18%, transparent), transparent 46%)",
        }}
      >
        {isLoadingThread && messages.length === 0 ? (
          <p className="text-xs text-mist/80 text-center pt-8">
            Loading conversation…
          </p>
        ) : messages.length === 0 ? (
          <div className="text-center space-y-2 pt-10">
            <MessageCircle className="w-10 h-10 mx-auto text-glow/70" />
            <p className="text-xs text-mist/85 max-w-xs mx-auto">
              This thread has no messages yet. Say hello — the visitor sees it in
              their notification drawer on the live website.
            </p>
          </div>
        ) : (
          groupedMessages.map((group) => (
            <div key={group.label} className="space-y-2">
              <div className="flex justify-center">
                <span className="px-3 py-1 rounded-full text-[10px] font-semibold text-mist bg-abyss/70 border border-mist/25">
                  {group.label}
                </span>
              </div>

              {group.items.map((msg) => {
                const mine = msg.sender === "admin";
                const pending = msg.id < 0;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${mine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[82%] sm:max-w-[70%] rounded-[18px] px-3.5 py-2.5 ${
                        mine ? "rounded-br-[6px]" : "rounded-bl-[6px]"
                      }`}
                      style={
                        mine
                          ? {
                              background:
                                "linear-gradient(150deg, color-mix(in srgb, var(--ultra-600) 95%, transparent) 0%, color-mix(in srgb, var(--ultra-900) 95%, transparent) 100%)",
                              border: "1px solid color-mix(in srgb, var(--ultra-50) 42%, transparent)",
                              boxShadow: "0 10px 22px -12px color-mix(in srgb, var(--ultra-950) 90%, transparent)",
                            }
                          : {
                              background: "color-mix(in srgb, var(--ultra-200) 14%, transparent)",
                              border: "1px solid color-mix(in srgb, var(--ultra-50) 28%, transparent)",
                            }
                      }
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider text-mist/85 mb-1">
                        {mine ? "You · Admin" : selected.googleName || "Visitor"}
                      </p>
                      <p className="text-[13px] leading-relaxed text-ink whitespace-pre-wrap break-words">
                        {msg.body}
                      </p>
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-mist/75">
                        {pending ? "Sending…" : formatClock(msg.createdAt)}
                        {mine && !pending && (
                          <CheckCheck className="w-3 h-3 text-mist" />
                        )}
                        {!mine && !pending && <Check className="w-3 h-3" />}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="px-3 sm:px-4 py-3 border-t border-mist/20 bg-abyss/55 flex items-end gap-2"
      >
        <textarea
          ref={composerRef}
          value={draft}
          maxLength={MAX_CHARS}
          rows={1}
          onChange={(e) => {
            setDraft(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
          className="flex-1 resize-none px-3.5 py-2.5 rounded-2xl text-[13px] text-ink placeholder-[var(--ultra-200)]/60 bg-abyss/80 border border-mist/35 focus:outline-none focus:ring-2 focus:ring-glow max-h-[132px]"
        />
        <button
          type="submit"
          disabled={isSending || !draft.trim()}
          className="shrink-0 px-4 py-2.5 rounded-2xl font-display font-bold text-xs text-ink flex items-center gap-2 transition-ui cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, var(--ultra-600) 0%, var(--ultra-400) 100%)",
            border: "1px solid color-mix(in srgb, var(--ultra-50) 50%, transparent)",
          }}
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {isSending ? "Sending" : "Send"}
          </span>
        </button>
      </form>
    </div>
  ) : (
    <div className="h-full grid place-items-center p-6 text-center">
      <div className="space-y-2 max-w-xs">
        <MessageCircle className="w-11 h-11 mx-auto text-glow/70" />
        <h3 className="font-display font-bold text-base text-ink">
          Pick a conversation
        </h3>
        <p className="text-xs text-mist/80">
          Visitors sign in with a real Google account on mindspark-all and their
          messages land here as a live two-way thread.
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-3 animate-pop-in">
      {error && (
        <div
          className="rounded-2xl px-4 py-3 text-xs text-[#F8D3DF] border"
          style={{
            background: "rgba(120,15,60,0.35)",
            borderColor: "rgba(248,175,197,0.4)",
          }}
        >
          {error}
        </div>
      )}

      <div
        className="rounded-[26px] overflow-hidden"
        style={{ ...GLASS_PANEL, height: "min(74vh, 680px)" }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(260px,320px)_1fr] h-full min-h-0">
          {/* Rail: always visible on desktop, swapped for the thread on mobile */}
          <div
            className={`min-h-0 border-r border-mist/20 ${
              mobileThreadOpen && selected ? "hidden lg:block" : "block"
            }`}
          >
            {rail}
          </div>

          {/* Thread: always visible on desktop, replaces the rail on mobile */}
          <div
            className={`min-h-0 ${
              mobileThreadOpen && selected ? "block" : "hidden lg:block"
            }`}
          >
            {thread}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-mist/70 flex items-center gap-1.5 px-1">
        <ShieldCheck className="w-3.5 h-3.5 text-glow" />
        Chats refresh automatically. Identity is taken from the visitor&apos;s
        verified Google sign-in — it cannot be spoofed from the browser.
      </p>
    </div>
  );
};

export default AdminChat;
