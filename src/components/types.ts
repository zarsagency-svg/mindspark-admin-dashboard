/** An announcement as rendered by the admin console. */
export interface AnnouncementItem {
  /** UUID text id — the live site identifies notifications by this value. */
  id: string;
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

/** A message in the admin inbox. */
export interface StudentMessageItem {
  id: number;
  /** 'google' = signed in with a real Google account, 'visitor' = anonymous. */
  source?: "google" | "visitor";
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

/** One WhatsApp-style chat thread with a signed-in Google user. */
export interface ChatConversationItem {
  id: string;
  googleEmail: string;
  googleName: string;
  /** Google profile photo URL, empty for legacy anonymous threads. */
  googleAvatar: string;
  /** Two-letter fallback when there is no photo. */
  googleAvatarInitials: string;
  lastMessagePreview: string;
  lastSender: "visitor" | "admin";
  unreadByAdmin: number;
  unreadByVisitor: number;
  /** Epoch milliseconds. */
  lastMessageAt: number;
  createdAt: number;
}

/** A single bubble inside a chat thread. */
export interface ChatMessageItem {
  id: number;
  conversationId: string;
  sender: "visitor" | "admin";
  body: string;
  /** Epoch milliseconds. */
  createdAt: number;
}
