import { db, pool } from "@/db";
import {
  platforms,
  announcements,
  studentMessages,
  siteSettings,
} from "@/db/schema";
import { DEFAULT_PLATFORMS } from "@/data/platforms";
import { count } from "drizzle-orm";

let initialized = false;

export async function ensureSeeded() {
  if (initialized) return;

  try {
    // 1. Ensure tables exist idempotently
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platforms (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        subtitle TEXT NOT NULL,
        meta_text TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'boards',
        href TEXT DEFAULT '',
        is_modal BOOLEAN NOT NULL DEFAULT false,
        title TEXT NOT NULL,
        img_src TEXT NOT NULL,
        img_alt TEXT NOT NULL,
        object_fit TEXT NOT NULL DEFAULT 'cover',
        tilt_angle INTEGER NOT NULL DEFAULT -8,
        accent_shade TEXT NOT NULL DEFAULT '#2E5DE6',
        delay_ms INTEGER NOT NULL DEFAULT 150,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        text TEXT NOT NULL,
        tag TEXT NOT NULL DEFAULT 'Official Broadcast',
        image_url TEXT DEFAULT '',
        author_name TEXT NOT NULL DEFAULT 'Mr Sad · Admin',
        is_pinned BOOLEAN NOT NULL DEFAULT false,
        likes INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS announcement_likes (
        id SERIAL PRIMARY KEY,
        announcement_id INTEGER NOT NULL,
        visitor_id TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS student_messages (
        id SERIAL PRIMARY KEY,
        google_email TEXT NOT NULL,
        google_name TEXT NOT NULL,
        google_avatar TEXT NOT NULL,
        google_sub TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'Batch Request',
        subject TEXT NOT NULL DEFAULT '',
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'unread',
        admin_reply TEXT DEFAULT '',
        replied_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        palette TEXT NOT NULL DEFAULT 'blue',
        custom_colour TEXT NOT NULL DEFAULT '#a855f7',
        card_style TEXT NOT NULL DEFAULT 'folder',
        allow_user_theme_override BOOLEAN NOT NULL DEFAULT true,
        telegram_channel TEXT NOT NULL DEFAULT 'https://t.me/zarsstudy',
        admin_passcode TEXT NOT NULL DEFAULT 'mindspark2026',
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Seed platforms if empty
    const [{ value: platformCount }] = await db
      .select({ value: count() })
      .from(platforms);
    if (Number(platformCount) === 0) {
      await db.insert(platforms).values(
        DEFAULT_PLATFORMS.map((p, idx) => ({
          name: p.name,
          subtitle: p.subtitle,
          metaText: p.metaText,
          category: p.category,
          href: p.href || "",
          isModal: Boolean(p.isModal),
          title: p.title,
          imgSrc: p.imgSrc,
          imgAlt: p.imgAlt,
          objectFit: p.objectFit,
          tiltAngle: p.tiltAngle,
          accentShade: p.accentShade,
          delayMs: p.delayMs,
          sortOrder: p.sortOrder ?? idx + 1,
        }))
      );
    }

    // 3. Seed announcements if empty
    const [{ value: announcementCount }] = await db
      .select({ value: count() })
      .from(announcements);
    if (Number(announcementCount) === 0) {
      await db.insert(announcements).values([
        {
          title: "A message from Mr Sad, Admin",
          text: "Hello everyone, I am Mr Sad, the administrator of MIND SPARK. I hope you are all doing well. It is a pleasure to have you here — I will be sharing important updates, new batch releases, and announcements through this channel. You can now also sign in with your Google account inside this drawer to message me directly!",
          tag: "Pinned Announcement",
          authorName: "Mr Sad · Admin",
          isPinned: true,
          likes: 24,
        },
        {
          title: "MIND SPARK 3D Glass Ecosystem & Student Inbox Live",
          text: "All 8 learning platforms — Next Toppers, NoxGlass, Mission Jeet, Master Sahab, UNC Offline, UNC, Vibrant Academy & Physics Wallah Dual-Server — are active and 100% free for every student. Need a new batch or found a broken lecture link? Use the 'Message Admin' tab with Google Sign-In!",
          tag: "Platform Release",
          authorName: "Mr Sad · Admin",
          isPinned: false,
          likes: 41,
        },
        {
          title: "JEE Advanced & Class 12 Board Revision Vault Updated",
          text: "New high-speed lecture mirrors for Vibrant Academy Kota Star Faculty and Next Toppers Foundation batches have been synchronized. Zero ads, distraction-free study.",
          tag: "Batch Alert",
          authorName: "Mr Sad · Admin",
          isPinned: false,
          likes: 18,
        },
      ]);
    }

    // 4. Seed student messages if empty
    const [{ value: msgCount }] = await db
      .select({ value: count() })
      .from(studentMessages);
    if (Number(msgCount) === 0) {
      await db.insert(studentMessages).values([
        {
          googleEmail: "aarav.sharma.jee2026@gmail.com",
          googleName: "Aarav Sharma",
          googleAvatar: "AS",
          googleSub: "google-oauth2|10928374651",
          category: "Batch Request",
          subject: "Requesting Arjuna JEE 2.0 Organic Chemistry DPPs",
          message:
            "Hi Mr Sad! Thank you so much for making MIND SPARK free for everyone. Could you please upload the latest Organic Chemistry DPP PDFs in the Physics Wallah / Mission Jeet section?",
          status: "replied",
          adminReply:
            "Hey Aarav! Glad MIND SPARK is helping your prep. I have synced the new Organic Chemistry DPPs on Server 1 & Mission Jeet folder. Happy studying!",
          repliedAt: new Date(Date.now() - 1000 * 60 * 45),
        },
        {
          googleEmail: "priya.verma.boards@gmail.com",
          googleName: "Priya Verma",
          googleAvatar: "PV",
          googleSub: "google-oauth2|10928374652",
          category: "Appreciation & Feedback",
          subject: "NoxGlass Distraction-Free Player is amazing!",
          message:
            "Sir the NoxGlass YouTube study player helped me study 6 hours straight without getting distracted by recommendations. Please keep this platform running forever!",
          status: "unread",
          adminReply: "",
        },
        {
          googleEmail: "rohan.kota.aspirant@gmail.com",
          googleName: "Rohan Patidar",
          googleAvatar: "RP",
          googleSub: "google-oauth2|10928374653",
          category: "Technical Support",
          subject: "UNC Offline Kota Mechanics Lecture 14 audio check",
          message:
            "Hello Admin, in UNC Offline Kota Classroom batch, Lecture 14 of Rotational Motion takes a few extra seconds to buffer on mobile data. Server 2 works great though!",
          status: "unread",
          adminReply: "",
        },
      ]);
    }

    // 5. Seed site settings if empty
    const [{ value: settingsCount }] = await db
      .select({ value: count() })
      .from(siteSettings);
    if (Number(settingsCount) === 0) {
      await db.insert(siteSettings).values({
        palette: "blue",
        customColour: "#a855f7",
        cardStyle: "folder",
        allowUserThemeOverride: true,
        telegramChannel: "https://t.me/zarsstudy",
        adminPasscode: "mindspark2026",
      });
    }

    initialized = true;
  } catch (err) {
    console.error("Database seed warning:", err);
  }
}
