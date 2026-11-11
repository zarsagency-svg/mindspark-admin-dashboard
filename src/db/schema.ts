import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const platforms = pgTable("platforms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subtitle: text("subtitle").notNull(),
  metaText: text("meta_text").notNull(),
  category: text("category").notNull().default("boards"), // 'boards' | 'jee-neet' | 'tools'
  href: text("href").default(""),
  isModal: boolean("is_modal").notNull().default(false),
  title: text("title").notNull(),
  imgSrc: text("img_src").notNull(),
  imgAlt: text("img_alt").notNull(),
  objectFit: text("object_fit").notNull().default("cover"), // 'contain' | 'cover'
  tiltAngle: integer("tilt_angle").notNull().default(-8),
  accentShade: text("accent_shade").notNull().default("#2E5DE6"),
  delayMs: integer("delay_ms").notNull().default(150),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  text: text("text").notNull(),
  tag: text("tag").notNull().default("Official Broadcast"),
  imageUrl: text("image_url").default(""),
  authorName: text("author_name").notNull().default("Mr Sad · Admin"),
  isPinned: boolean("is_pinned").notNull().default(false),
  likes: integer("likes").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcementLikes = pgTable("announcement_likes", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull(),
  visitorId: text("visitor_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const studentMessages = pgTable("student_messages", {
  id: serial("id").primaryKey(),
  googleEmail: text("google_email").notNull(),
  googleName: text("google_name").notNull(),
  googleAvatar: text("google_avatar").notNull(),
  googleSub: text("google_sub").notNull(),
  category: text("category").notNull().default("Batch Request"),
  subject: text("subject").notNull().default(""),
  message: text("message").notNull(),
  status: text("status").notNull().default("unread"), // 'unread' | 'read' | 'replied'
  adminReply: text("admin_reply").default(""),
  repliedAt: timestamp("replied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const siteSettings = pgTable("site_settings", {
  id: serial("id").primaryKey(),
  palette: text("palette").notNull().default("blue"), // 'blue' | 'red' | 'green' | 'custom'
  customColour: text("custom_colour").notNull().default("#a855f7"),
  cardStyle: text("card_style").notNull().default("folder"), // 'folder' | 'card'
  allowUserThemeOverride: boolean("allow_user_theme_override").notNull().default(true),
  telegramChannel: text("telegram_channel").notNull().default("https://t.me/zarsstudy"),
  adminPasscode: text("admin_passcode").notNull().default("mindspark2026"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlatformRow = typeof platforms.$inferSelect;
export type NewPlatformRow = typeof platforms.$inferInsert;
export type AnnouncementRow = typeof announcements.$inferSelect;
export type StudentMessageRow = typeof studentMessages.$inferSelect;
export type SiteSettingsRow = typeof siteSettings.$inferSelect;
