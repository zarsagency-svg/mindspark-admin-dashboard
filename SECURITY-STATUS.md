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

`public.lecture_visitor_messages` is mirrored into the unified inbox
(`public.student_messages`) by a trigger, so anonymous lecture messages and
Google-verified student messages land in one place without breaking the lecture
site.

## Student messages

`public.submit_student_message(category, subject, message)` is for the visitor
site. It reads the sender's email, name and Google `sub` from the **verified auth
identity**, never from the request body, requires a confirmed Google sign-in, and
rate-limits to one message per minute per account.

## Not yet implemented / not verified

- Replies are stored (`admin_reply`, `status = 'replied'`) but **not emailed** —
  there is no mail integration. The console says "Reply saved", not "sent".
- Platform logos for Next Toppers, Mission Jeet, Vibrant Academy and Physics
  Wallah were not included in the source drop, so the Platform Architect seeds
  generated glass logos for those four. Replace them by editing each platform.
- Platforms and appearance settings are stored and editable, but the live site
  does not read `public.public_site_config()` yet, so changing them does not
  currently restyle https://mindspark-all.vercel.app.
- Google OAuth sign-in and admin operations need a real browser session, so they
  have not been exercised end to end. Anonymous access to every admin RPC was
  tested and denied (`42501`), and a non-allowlisted authenticated user was
  denied by `admin_assert()`.
