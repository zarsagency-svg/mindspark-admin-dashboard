-- =============================================================================
-- Mind Spark — rebuild the schema for the rich admin console.
--
-- Preserves existing data: announcements (3), visitor likes (28) and the
-- visitor message (1) are all carried into the rebuilt tables.
--
-- PRESERVED PUBLIC CONTRACT for https://mindspark-all.vercel.app (unchanged):
--   table    public.mindspark_notifications (id text, title, body, created_at, image_url)
--   table    public.mindspark_notification_likes (notification_id text, visitor_id uuid)
--   function public.mindspark_get_notifications(p_visitor_id uuid)
--   function public.mindspark_get_notifications_v2(p_visitor_id uuid)
--   function public.mindspark_set_notification_like(text, uuid, boolean)
--   function public.lecture_submit_visitor_message(uuid, text, text)
-- =============================================================================

-- 1) Administrator allowlist --------------------------------------------------
insert into public.mindspark_admins(email, note) values
  ('sadikurahman321@gmail.com', 'Added as administrator on 2026-11-11')
on conflict (email) do nothing;

-- 2) Rebuild the announcements table (keeps the live notification feed) -------
create table public.mindspark_notifications_rebuild (
  id          text primary key default (gen_random_uuid())::text,
  title       text not null default '',
  body        text not null,
  image_url   text,
  tag         text not null default 'Official Broadcast',
  author_name text not null default 'Mr Sad · Admin',
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now()
);

insert into public.mindspark_notifications_rebuild (id, title, body, image_url, created_at)
select id, title, body, image_url, created_at
from public.mindspark_notifications;

-- Cascade drops the SQL-language reader functions and the likes FK; both are
-- recreated below. The 28 like rows survive (only the constraint is dropped).
drop table public.mindspark_notifications cascade;

alter table public.mindspark_notifications_rebuild rename to mindspark_notifications;

alter table public.mindspark_notification_likes
  add constraint mindspark_notification_likes_notification_id_fkey
  foreign key (notification_id) references public.mindspark_notifications(id) on delete cascade;

create index if not exists mindspark_notifications_created_at_idx
  on public.mindspark_notifications (created_at desc, id desc);

alter table public.mindspark_notifications enable row level security;
revoke all on public.mindspark_notifications from public, anon, authenticated;

-- 3) Restore the public notification functions EXACTLY as the live site expects
create or replace function public.mindspark_get_notifications(p_visitor_id uuid default null)
returns table(id text, title text, body text, created_at timestamptz, likes bigint, liked boolean)
language sql stable security definer set search_path = '' as $$
  select n.id, n.title, n.body, n.created_at,
    (select count(*) from public.mindspark_notification_likes l where l.notification_id = n.id),
    exists (select 1 from public.mindspark_notification_likes l where l.notification_id = n.id and l.visitor_id = p_visitor_id)
  from public.mindspark_notifications n
  order by n.created_at desc, n.id desc;
$$;

create or replace function public.mindspark_get_notifications_v2(p_visitor_id uuid default null)
returns table(id text, title text, body text, created_at timestamptz, likes bigint, liked boolean, image_url text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.title, n.body, n.created_at,
    (select count(*) from public.mindspark_notification_likes l where l.notification_id = n.id),
    exists (select 1 from public.mindspark_notification_likes l where l.notification_id = n.id and l.visitor_id = p_visitor_id),
    n.image_url
  from public.mindspark_notifications n
  order by n.created_at desc, n.id desc;
$$;

create or replace function public.mindspark_set_notification_like(p_message_id text, p_visitor_id uuid, p_liked boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_visitor_id is null or p_message_id is null or p_liked is null then
    raise exception 'Missing required like parameters' using errcode = '22023';
  end if;
  if not exists (select 1 from public.mindspark_notifications where id = p_message_id) then
    raise exception 'Notification not found' using errcode = '22023';
  end if;
  if p_liked then
    insert into public.mindspark_notification_likes(notification_id, visitor_id)
    values (p_message_id, p_visitor_id) on conflict do nothing;
  else
    delete from public.mindspark_notification_likes
    where notification_id = p_message_id and visitor_id = p_visitor_id;
  end if;
  return jsonb_build_object('ok', true);
end; $$;

revoke all on function public.mindspark_get_notifications(uuid) from public;
grant execute on function public.mindspark_get_notifications(uuid) to anon, authenticated, service_role;
revoke all on function public.mindspark_get_notifications_v2(uuid) from public;
grant execute on function public.mindspark_get_notifications_v2(uuid) to anon, authenticated, service_role;
revoke all on function public.mindspark_set_notification_like(text, uuid, boolean) from public;
grant execute on function public.mindspark_set_notification_like(text, uuid, boolean) to anon, authenticated, service_role;

-- 4) Student / visitor inbox --------------------------------------------------
drop table if exists public.student_messages cascade;
create table public.student_messages (
  id            integer generated always as identity primary key,
  source        text not null default 'google' check (source in ('google','visitor')),
  google_email  text not null default '',
  google_name   text not null default '',
  google_avatar text not null default '',
  google_sub    text not null default '',
  visitor_id    uuid,
  category      text not null default 'Batch Request',
  subject       text not null default 'Student Inquiry',
  message       text not null,
  status        text not null default 'unread' check (status in ('unread','read','replied')),
  admin_reply   text not null default '',
  replied_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists student_messages_created_at_idx on public.student_messages (created_at desc);
alter table public.student_messages enable row level security;
revoke all on public.student_messages from public, anon, authenticated;

-- Carry the existing visitor message into the unified admin inbox.
insert into public.student_messages
  (source, google_email, google_name, google_avatar, google_sub, visitor_id, category, subject, message, status, created_at)
select 'visitor', '', coalesce(m.sender_name, 'Anonymous visitor'),
       upper(left(coalesce(nullif(btrim(m.sender_name), ''), 'V'), 2)), '',
       m.visitor_id, 'Visitor Message', coalesce(nullif(btrim(m.source), ''), 'Visitor Message'),
       m.message, case when m.read_at is null then 'unread' else 'read' end, m.created_at
from public.lecture_visitor_messages m
where not exists (
  select 1 from public.student_messages s
  where s.visitor_id = m.visitor_id and s.created_at = m.created_at
);

-- New anonymous messages from the lecture site keep flowing into the inbox.
create or replace function public.mindspark_mirror_visitor_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.student_messages
    (source, google_email, google_name, google_avatar, google_sub, visitor_id, category, subject, message, status, created_at)
  values
    ('visitor', '', coalesce(new.sender_name, 'Anonymous visitor'),
     upper(left(coalesce(nullif(btrim(new.sender_name), ''), 'V'), 2)), '',
     new.visitor_id, 'Visitor Message', coalesce(nullif(btrim(new.source), ''), 'Visitor Message'),
     new.message, 'unread', new.created_at);
  return new;
end; $$;

drop trigger if exists mindspark_mirror_visitor_message on public.lecture_visitor_messages;
create trigger mindspark_mirror_visitor_message
  after insert on public.lecture_visitor_messages
  for each row execute function public.mindspark_mirror_visitor_message();

-- 5) Platforms ----------------------------------------------------------------
drop table if exists public.platforms cascade;
create table public.platforms (
  id           integer generated always as identity primary key,
  name         text not null,
  subtitle     text not null default '',
  meta_text    text not null default 'Free Access · Live & Recorded',
  category     text not null default 'boards' check (category in ('boards','jee-neet','tools')),
  href         text not null default '',
  is_modal     boolean not null default false,
  title        text not null default '',
  img_src      text not null default '',
  img_alt      text not null default '',
  object_fit   text not null default 'cover' check (object_fit in ('cover','contain')),
  tilt_angle   integer not null default -8,
  accent_shade text not null default '#2E5DE6',
  delay_ms     integer not null default 150,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.platforms enable row level security;
revoke all on public.platforms from public, anon, authenticated;

-- 6) Site settings (no passcode column: admin auth is Google-only) ------------
drop table if exists public.site_settings cascade;
create table public.site_settings (
  id                       integer primary key default 1 constraint site_settings_singleton check (id = 1),
  palette                  text not null default 'blue' check (palette in ('blue','red','green','custom')),
  custom_colour            text not null default '#a855f7',
  card_style               text not null default 'folder' check (card_style in ('folder','card')),
  allow_user_theme_override boolean not null default true,
  telegram_channel         text not null default 'https://t.me/zarsstudy',
  updated_at               timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;
alter table public.site_settings enable row level security;
revoke all on public.site_settings from public, anon, authenticated;

-- 7) Admin helpers ------------------------------------------------------------
create or replace function public.admin_assert()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.mindspark_is_admin() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
end; $$;
revoke all on function public.admin_assert() from public, anon, authenticated;

create or replace function public.mindspark_announcement_json(p_id text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', n.id,
    'title', n.title,
    'text', n.body,
    'tag', n.tag,
    'imageUrl', nullif(n.image_url, ''),
    'authorName', n.author_name,
    'isPinned', n.is_pinned,
    'likes', (select count(*) from public.mindspark_notification_likes l where l.notification_id = n.id),
    'liked', false,
    'createdAt', floor(extract(epoch from n.created_at) * 1000)::bigint
  ) from public.mindspark_notifications n where n.id = p_id;
$$;
revoke all on function public.mindspark_announcement_json(text) from public, anon, authenticated;

create or replace function public.mindspark_message_json(p_id integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', m.id,
    'source', m.source,
    'googleEmail', m.google_email,
    'googleName', m.google_name,
    'googleAvatar', m.google_avatar,
    'googleSub', m.google_sub,
    'category', m.category,
    'subject', m.subject,
    'message', m.message,
    'status', m.status,
    'adminReply', m.admin_reply,
    'repliedAt', case when m.replied_at is null then null else floor(extract(epoch from m.replied_at) * 1000)::bigint end,
    'createdAt', floor(extract(epoch from m.created_at) * 1000)::bigint
  ) from public.student_messages m where m.id = p_id;
$$;
revoke all on function public.mindspark_message_json(integer) from public, anon, authenticated;

create or replace function public.mindspark_platform_json(p_id integer)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'subtitle', p.subtitle, 'metaText', p.meta_text,
    'category', p.category, 'href', p.href, 'isModal', p.is_modal, 'title', p.title,
    'imgSrc', p.img_src, 'imgAlt', p.img_alt, 'objectFit', p.object_fit,
    'tiltAngle', p.tilt_angle, 'accentShade', p.accent_shade, 'delayMs', p.delay_ms,
    'sortOrder', p.sort_order
  ) from public.platforms p where p.id = p_id;
$$;
revoke all on function public.mindspark_platform_json(integer) from public, anon, authenticated;

-- 8) Announcement admin RPCs --------------------------------------------------
create or replace function public.admin_list_announcements()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  return coalesce((
    select jsonb_agg(public.mindspark_announcement_json(n.id)
                     order by n.is_pinned desc, n.created_at desc, n.id desc)
    from public.mindspark_notifications n
  ), '[]'::jsonb);
end; $$;

create or replace function public.admin_create_announcement(
  p_title text, p_body text, p_tag text default null, p_image_url text default null, p_is_pinned boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_id text;
begin
  perform public.admin_assert();
  if p_title is null or length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Announcement title must be 1-160 characters' using errcode = '22023';
  end if;
  if p_body is null or length(btrim(p_body)) not between 1 and 8000 then
    raise exception 'Announcement body must be 1-8000 characters' using errcode = '22023';
  end if;
  insert into public.mindspark_notifications (title, body, tag, image_url, is_pinned)
  values (btrim(p_title), btrim(p_body),
          coalesce(nullif(btrim(p_tag), ''), 'Official Broadcast'),
          nullif(btrim(coalesce(p_image_url, '')), ''),
          coalesce(p_is_pinned, false))
  returning id into v_id;
  return jsonb_build_object('announcement', public.mindspark_announcement_json(v_id));
end; $$;

create or replace function public.admin_update_announcement(
  p_id text, p_title text default null, p_body text default null, p_tag text default null,
  p_image_url text default null, p_is_pinned boolean default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  if p_id is null or not exists (select 1 from public.mindspark_notifications n where n.id = p_id) then
    raise exception 'Announcement not found' using errcode = '22023';
  end if;
  update public.mindspark_notifications n set
    title     = case when p_title is null then n.title else btrim(p_title) end,
    body      = case when p_body is null then n.body else btrim(p_body) end,
    tag       = case when p_tag is null then n.tag else coalesce(nullif(btrim(p_tag), ''), 'Official Broadcast') end,
    image_url = case when p_image_url is null then n.image_url else nullif(btrim(p_image_url), '') end,
    is_pinned = case when p_is_pinned is null then n.is_pinned else p_is_pinned end
  where n.id = p_id;
  return jsonb_build_object('announcement', public.mindspark_announcement_json(p_id));
end; $$;

create or replace function public.admin_delete_announcement(p_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  delete from public.mindspark_notifications where id = p_id;
  return jsonb_build_object('deletedId', p_id);
end; $$;

-- 9) Inbox admin RPCs ---------------------------------------------------------
create or replace function public.admin_list_messages()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  return jsonb_build_object(
    'messages', coalesce((
      select jsonb_agg(public.mindspark_message_json(m.id) order by m.created_at desc, m.id desc)
      from public.student_messages m), '[]'::jsonb),
    'unreadCount', (select count(*) from public.student_messages where status = 'unread')
  );
end; $$;

create or replace function public.admin_set_message_status(p_id integer, p_status text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  if p_status not in ('unread','read','replied') then
    raise exception 'Invalid message status' using errcode = '22023';
  end if;
  update public.student_messages set status = p_status where id = p_id;
  if not found then raise exception 'Message not found' using errcode = '22023'; end if;
  return jsonb_build_object('message', public.mindspark_message_json(p_id));
end; $$;

create or replace function public.admin_reply_message(p_id integer, p_reply text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_reply text := btrim(coalesce(p_reply, ''));
begin
  perform public.admin_assert();
  if length(v_reply) > 8000 then
    raise exception 'Reply must be under 8000 characters' using errcode = '22023';
  end if;
  update public.student_messages set
    admin_reply = v_reply,
    status = case when v_reply = '' then status else 'replied' end,
    replied_at = case when v_reply = '' then replied_at else now() end
  where id = p_id;
  if not found then raise exception 'Message not found' using errcode = '22023'; end if;
  return jsonb_build_object('message', public.mindspark_message_json(p_id));
end; $$;

create or replace function public.admin_delete_message(p_id integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  delete from public.student_messages where id = p_id;
  return jsonb_build_object('deletedId', p_id);
end; $$;

-- Public: a signed-in Google user submits a message to the admin. Identity is
-- taken from the verified auth record, never from the request body.
create or replace function public.submit_student_message(
  p_category text default null, p_subject text default null, p_message text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text; v_name text; v_avatar text; v_sub text; v_id integer;
  v_message text := btrim(coalesce(p_message, ''));
begin
  if v_uid is null then
    raise exception 'Sign in with Google to message the admin' using errcode = '42501';
  end if;
  if length(v_message) not between 1 and 4000 then
    raise exception 'Message must be 1-4000 characters' using errcode = '22023';
  end if;

  select lower(u.email),
         coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                  nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), split_part(u.email, '@', 1))
    into v_email, v_name
  from auth.users u
  where u.id = v_uid and u.email_confirmed_at is not null;

  if v_email is null then
    raise exception 'A confirmed Google account is required' using errcode = '42501';
  end if;

  select i.provider || '|' || coalesce(i.identity_data ->> 'provider_id', i.identity_id::text)
    into v_sub
  from auth.identities i
  where i.user_id = v_uid and i.provider = 'google'
    and lower(i.identity_data ->> 'email') = v_email
    and i.identity_data ->> 'email_verified' = 'true'
  limit 1;

  if v_sub is null then
    raise exception 'A verified Google sign-in is required' using errcode = '42501';
  end if;

  -- Display initials (e.g. "SR"), matching what the admin inbox renders.
  select upper(left(coalesce(string_agg(left(w, 1), ''), ''), 2))
    into v_avatar
  from unnest(regexp_split_to_array(v_name, '\s+')) as w
  where w <> '';
  v_avatar := coalesce(nullif(btrim(coalesce(v_avatar, '')), ''), 'ST');

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 1));
  if exists (select 1 from public.student_messages where source = 'google' and google_sub = v_sub
               and created_at > now() - interval '60 seconds') then
    raise exception 'Please wait one minute before sending another message' using errcode = '42929';
  end if;

  insert into public.student_messages
    (source, google_email, google_name, google_avatar, google_sub, category, subject, message)
  values ('google', v_email, v_name, v_avatar, v_sub,
          coalesce(nullif(btrim(coalesce(p_category, '')), ''), 'Batch Request'),
          coalesce(nullif(btrim(coalesce(p_subject, '')), ''), 'Student Inquiry'),
          v_message)
  returning id into v_id;

  return jsonb_build_object('message', public.mindspark_message_json(v_id));
end; $$;

revoke all on function public.submit_student_message(text, text, text) from public, anon;
grant execute on function public.submit_student_message(text, text, text) to authenticated;

-- 10) Platform admin RPCs -----------------------------------------------------
create or replace function public.admin_list_platforms()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  return coalesce((
    select jsonb_agg(public.mindspark_platform_json(p.id) order by p.sort_order, p.id)
    from public.platforms p), '[]'::jsonb);
end; $$;

create or replace function public.admin_save_platform(p_platform jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id integer := nullif(btrim(coalesce(p_platform ->> 'id', '')), '')::integer;
  v_name text := btrim(coalesce(p_platform ->> 'name', ''));
  v_new_id integer;
begin
  perform public.admin_assert();
  if v_name = '' then raise exception 'Platform name is required' using errcode = '22023'; end if;

  if v_id is not null and exists (select 1 from public.platforms where id = v_id) then
    update public.platforms p set
      name = v_name,
      subtitle = btrim(coalesce(p_platform ->> 'subtitle', '')),
      meta_text = coalesce(nullif(btrim(p_platform ->> 'metaText'), ''), 'Free Access · Live & Recorded'),
      category = case when p_platform ->> 'category' in ('boards','jee-neet','tools') then p_platform ->> 'category' else p.category end,
      href = coalesce(p_platform ->> 'href', ''),
      is_modal = coalesce((p_platform ->> 'isModal')::boolean, false),
      title = coalesce(nullif(btrim(p_platform ->> 'title'), ''), v_name || ' - MIND SPARK'),
      img_src = coalesce(p_platform ->> 'imgSrc', ''),
      img_alt = coalesce(p_platform ->> 'imgAlt', v_name || ' Logo'),
      object_fit = case when p_platform ->> 'objectFit' in ('cover','contain') then p_platform ->> 'objectFit' else p.object_fit end,
      tilt_angle = coalesce(nullif(btrim(p_platform ->> 'tiltAngle'), '')::integer, p.tilt_angle),
      accent_shade = coalesce(nullif(btrim(p_platform ->> 'accentShade'), ''), p.accent_shade)
    where p.id = v_id;
    return jsonb_build_object('platform', public.mindspark_platform_json(v_id));
  end if;

  insert into public.platforms
    (name, subtitle, meta_text, category, href, is_modal, title, img_src, img_alt,
     object_fit, tilt_angle, accent_shade, delay_ms, sort_order)
  values (
    v_name,
    btrim(coalesce(p_platform ->> 'subtitle', '')),
    coalesce(nullif(btrim(p_platform ->> 'metaText'), ''), 'Free Access · Live & Recorded'),
    case when p_platform ->> 'category' in ('boards','jee-neet','tools') then p_platform ->> 'category' else 'boards' end,
    coalesce(p_platform ->> 'href', ''),
    coalesce((p_platform ->> 'isModal')::boolean, false),
    coalesce(nullif(btrim(p_platform ->> 'title'), ''), v_name || ' - MIND SPARK'),
    coalesce(p_platform ->> 'imgSrc', ''),
    coalesce(p_platform ->> 'imgAlt', v_name || ' Logo'),
    case when p_platform ->> 'objectFit' in ('cover','contain') then p_platform ->> 'objectFit' else 'cover' end,
    coalesce(nullif(btrim(p_platform ->> 'tiltAngle'), '')::integer, -8),
    coalesce(nullif(btrim(p_platform ->> 'accentShade'), ''), '#2E5DE6'),
    coalesce(nullif(btrim(p_platform ->> 'delayMs'), '')::integer, 150),
    coalesce(nullif(btrim(p_platform ->> 'sortOrder'), '')::integer,
             (select coalesce(max(sort_order), 0) + 1 from public.platforms))
  ) returning id into v_new_id;
  return jsonb_build_object('platform', public.mindspark_platform_json(v_new_id));
end; $$;

create or replace function public.admin_delete_platform(p_id integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  delete from public.platforms where id = p_id;
  return jsonb_build_object('deletedId', p_id);
end; $$;

create or replace function public.admin_reset_platforms(p_platforms jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  if jsonb_typeof(p_platforms) <> 'array' then
    raise exception 'Expected an array of platforms' using errcode = '22023';
  end if;
  delete from public.platforms;
  insert into public.platforms
    (name, subtitle, meta_text, category, href, is_modal, title, img_src, img_alt,
     object_fit, tilt_angle, accent_shade, delay_ms, sort_order)
  select
    btrim(coalesce(item ->> 'name', '')),
    btrim(coalesce(item ->> 'subtitle', '')),
    coalesce(nullif(btrim(item ->> 'metaText'), ''), 'Free Access · Live & Recorded'),
    case when item ->> 'category' in ('boards','jee-neet','tools') then item ->> 'category' else 'boards' end,
    coalesce(item ->> 'href', ''),
    coalesce((item ->> 'isModal')::boolean, false),
    coalesce(nullif(btrim(item ->> 'title'), ''), btrim(coalesce(item ->> 'name', '')) || ' - MIND SPARK'),
    coalesce(item ->> 'imgSrc', ''),
    coalesce(nullif(btrim(item ->> 'imgAlt'), ''), btrim(coalesce(item ->> 'name', '')) || ' Logo'),
    case when item ->> 'objectFit' in ('cover','contain') then item ->> 'objectFit' else 'cover' end,
    coalesce(nullif(btrim(item ->> 'tiltAngle'), '')::integer, -8),
    coalesce(nullif(btrim(item ->> 'accentShade'), ''), '#2E5DE6'),
    coalesce(nullif(btrim(item ->> 'delayMs'), '')::integer, 150),
    coalesce(nullif(btrim(item ->> 'sortOrder'), '')::integer, ord::integer)
  from jsonb_array_elements(p_platforms) with ordinality as t(item, ord)
  where btrim(coalesce(item ->> 'name', '')) <> '';
  return jsonb_build_object('platforms', public.admin_list_platforms());
end; $$;

-- 11) Settings RPCs -----------------------------------------------------------
create or replace function public.admin_get_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  return public.public_site_config() -> 'settings';
end; $$;

create or replace function public.admin_save_settings(p_settings jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_assert();
  update public.site_settings s set
    palette = case when p_settings ->> 'palette' in ('blue','red','green','custom') then p_settings ->> 'palette' else s.palette end,
    custom_colour = coalesce(nullif(btrim(p_settings ->> 'customColour'), ''), s.custom_colour),
    card_style = case when p_settings ->> 'cardStyle' in ('folder','card') then p_settings ->> 'cardStyle' else s.card_style end,
    allow_user_theme_override = coalesce((p_settings ->> 'allowUserThemeOverride')::boolean, s.allow_user_theme_override),
    telegram_channel = coalesce(nullif(btrim(p_settings ->> 'telegramChannel'), ''), s.telegram_channel),
    updated_at = now()
  where s.id = 1;
  return jsonb_build_object('settings', public.admin_get_settings());
end; $$;

-- Public read-only config for the visitor-facing site on the other domain.
create or replace function public.public_site_config()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'settings', (select jsonb_build_object(
        'id', s.id, 'palette', s.palette, 'customColour', s.custom_colour,
        'cardStyle', s.card_style, 'allowUserThemeOverride', s.allow_user_theme_override,
        'telegramChannel', s.telegram_channel,
        'updatedAt', floor(extract(epoch from s.updated_at) * 1000)::bigint)
      from public.site_settings s where s.id = 1),
    'platforms', coalesce((
      select jsonb_agg(public.mindspark_platform_json(p.id) order by p.sort_order, p.id)
      from public.platforms p), '[]'::jsonb)
  );
$$;

-- 12) Grants ------------------------------------------------------------------
do $grant$
declare f text;
begin
  foreach f in array array[
    'admin_list_announcements()',
    'admin_create_announcement(text,text,text,text,boolean)',
    'admin_update_announcement(text,text,text,text,text,boolean)',
    'admin_delete_announcement(text)',
    'admin_list_messages()',
    'admin_set_message_status(integer,text)',
    'admin_reply_message(integer,text)',
    'admin_delete_message(integer)',
    'admin_list_platforms()',
    'admin_save_platform(jsonb)',
    'admin_delete_platform(integer)',
    'admin_reset_platforms(jsonb)',
    'admin_get_settings()',
    'admin_save_settings(jsonb)'
  ]
  loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $grant$;

revoke all on function public.public_site_config() from public;
grant execute on function public.public_site_config() to anon, authenticated, service_role;
