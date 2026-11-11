# Dashboard status

## What this is

The **admin console only**. The visitor-facing site lives on a separate domain
(https://mindspark-all.vercel.app) and is controlled from here — keeping the public
site and the admin panel on different deployments is deliberate.

Sign-in is Supabase **Google OAuth**. The passcode login and the fake "Google"
modal from the original design were removed; there is no `admin_passcode` column
and `POST /api/settings` now returns `405`.

## Authorization

Administrators are listed in `public.mindspark_admins` (currently
`zarsagency@gmail.com`, `zarsagency7@gmail.com`, `sadikurahman321@gmail.com`).

Every privileged path re-checks that list **inside the database**:

```
browser → /api/* route → Supabase RPC (SECURITY DEFINER)
                             └── public.admin_assert()
                                   └── public.mindspark_is_admin()
                                         ├── auth.uid() matches an allowlisted email
                                         ├── email_confirmed_at is set
                                         └── verified Google identity for that email
```

The React check in `src/app/page.tsx` only decides which screen to render; it is
not a security boundary. Tables have RLS enabled with **no** policies and all
direct grants revoked from `anon`/`authenticated`, so the only way in is through
the RPCs. `POST /api/settings`, the passcode field and every `pg`/Drizzle local
database dependency are gone.

## Contract with the live site

`https://mindspark-all.vercel.app` calls these, and they are unchanged:

| Object | Purpose |
| --- | --- |
| `public.mindspark_notifications` | announcements the admin publishes |
| `public.mindspark_notification_likes` | visitor likes (`notification_id`, `visitor_id`) |
| `public.mindspark_get_notifications_v2(uuid)` | the feed the site renders |
| `public.mindspark_get_notifications(uuid)` | older variant, kept working |
| `public.mindspark_set_notification_like(text,uuid,boolean)` | like/unlike |
| `public.lecture_submit_visitor_message(uuid,text,text)` | anonymous lecture-site messages |

An announcement published in **Broadcast Studio** is inserted into
`mindspark_notifications`, so it appears on the live site on its next fetch — no
extra wiring, no second store. Verified end to end inside a rolled-back
transaction: `admin_create_announcement()` → row visible to
`mindspark_get_notifications_v2()` with the same id.

`public.lecture_visitor_messages` is mirrored into the chat tables by a trigger,
so anonymous lecture messages still reach the admin without breaking the lecture
site.

## Visitor chat (WhatsApp-style)

Two-way chat between the live site and this console. The visitor opens the
notification drawer on https://mindspark-all.vercel.app, switches to the
**Chat with Admin** tab and signs in with a real Google account (OAuth2 + PKCE
against Supabase Auth — no passcode, no demo accounts).

| Object | Purpose |
| --- | --- |
| `public.chat_conversations` | one thread per Google `sub`, with previews and unread counters |
| `public.chat_messages` | the bubbles (`sender = 'visitor' \| 'admin'`) |
| `public.mindspark_google_identity()` | resolves the caller to a **verified** Google identity |
| `public.chat_my_conversation()` | visitor: open/refresh their own thread, clears their unread |
| `public.chat_send(text)` | visitor: post a bubble (1–2000 chars, 3s rate limit) |
| `public.admin_list_conversations()` | admin: the conversation rail |
| `public.admin_get_conversation(uuid)` | admin: open a thread, clears the admin unread |
| `public.admin_send_chat(uuid,text)` | admin: reply into the thread |
| `public.admin_delete_conversation(uuid)` | admin: delete a thread and its messages |

Both chat tables have RLS enabled with **no** policies and every grant revoked
from `anon`/`authenticated`, so they are reachable only through these RPCs.
`chat_*` is granted to `authenticated`; `admin_*` calls `admin_assert()` first.
Sender identity comes from `auth.users` + `auth.identities` — never from the
request body — so a visitor cannot post as someone else, and a non-admin token
cannot read or reply to any thread.

Verified end to end inside a rolled-back transaction: visitor `chat_send()` →
thread appears in `admin_list_conversations()` → `admin_get_conversation()` shows
the bubble → `admin_send_chat()` → visitor's `chat_my_conversation()` returns both
bubbles with `lastSender = 'admin'` and their unread counter incremented. An
anonymous call to `chat_my_conversation()` is denied with `42501`.

The four-rectangle telemetry strip that used to sit above the modules was removed
from the console; `AdminChat` now reports its unread total to the sidebar badge.

## Legacy student messages

`public.submit_student_message(category, subject, message)` and the
`public.student_messages` table remain for the older lecture-site contract, but
the console no longer renders them — the chat thread is the inbox now.

## Not yet implemented / not verified

- Platform logos for Next Toppers, Mission Jeet, Vibrant Academy and Physics
  Wallah are now the real `.webp` files, copied from the visitor site into
  `public/platforms/`, so `src/data/platforms.ts` no longer points at generated
  stand-ins.
- Chat delivery is poll-based (10s for the conversation rail, 5s for the open
  thread, 6s on the visitor side). There is no realtime subscription, so a reply
  can take a few seconds to appear.
- Notifications are in-app only — no email or push when a visitor writes in.
- Platforms and appearance settings are stored and editable, but the live site
  does not read `public.public_site_config()` yet, so changing them does not
  currently restyle https://mindspark-all.vercel.app.
- Google OAuth has been exercised for real: `auth.identities` holds verified
  Google identities for `zarsagency@gmail.com`, `zarsagency7@gmail.com` and
  `sadikurahman321@gmail.com`. Anonymous access to every admin and chat RPC was
  tested and denied (`42501`), and a non-allowlisted authenticated user is denied
  by `admin_assert()`.
